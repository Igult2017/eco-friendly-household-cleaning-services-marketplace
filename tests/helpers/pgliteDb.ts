import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import * as schema from "@/lib/db/schema"

/**
 * A real Postgres, in-process, built from the REAL production schema.
 *
 * PGlite is Postgres compiled to WebAssembly — not a fake or an in-memory imitation, so constraints,
 * enums, defaults and types behave exactly as they do on the server. That matters here: the bugs
 * this suite exists to pin were things like "the enum has no 'processing' value", which a stubbed
 * database would happily have accepted.
 *
 * The schema is built the same way production builds it:
 *   1. every file in drizzle/migrations, in order  (what `drizzle-kit migrate` applies)
 *   2. the enum additions and DDL from scripts/ensure-referrals.mjs
 * Step 2 is NOT optional — `bookings.identity_check_due_at`, the column this whole feature turns
 * on, is created there and in no migration, because the migration journal is drifted.
 */
export async function makeTestDb() {
  const client = new PGlite()
  await client.waitReady

  const root = process.cwd()

  // 1. The real migrations, in filename order. PostGIS is absent here, which is fine:
  // 0001_add_postgis.sql wraps itself in an exception-safe block for exactly that case.
  const migrationsDir = path.join(root, "drizzle", "migrations")
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    try {
      await client.exec(sql)
    } catch (err) {
      throw new Error(`migration ${file} failed against PGlite: ${(err as Error).message}`)
    }
  }

  // 2. The enum values and DDL the ensure-script adds on every production boot.
  for (const [type, value] of ENUM_ADDITIONS) {
    try { await client.exec(`ALTER TYPE ${type} ADD VALUE IF NOT EXISTS '${value}'`) } catch { /* already present */ }
  }

  // Statement by statement, not as one batch. A batch aborts at the first error, and this DDL
  // contains statements for tables production has but these migrations do not create (store_products).
  // Tolerating those is correct; what must NOT be tolerated is a missing identity column, which
  // assertSchema below checks explicitly rather than leaving to chance.
  for (const statement of splitStatements(readEnsureScriptDDL(root))) {
    try { await client.exec(statement) } catch { /* not every statement applies to a fresh database */ }
  }

  await assertSchema(client)
  return { client, db: drizzle(client, { schema }) }
}

/** Fails loudly if the columns this feature depends on did not get created. */
async function assertSchema(client: PGlite) {
  const required: Array<[string, string]> = [
    ["bookings", "identity_check_due_at"],
    ["bookings", "availability_asked_at"],
    ["provider_identity_verifications", "attempts"],
    ["providers", "verification_status"],
  ]
  for (const [table, column] of required) {
    const r = await client.query(
      `select 1 from information_schema.columns where table_name=$1 and column_name=$2`,
      [table, column],
    )
    if (r.rows.length === 0) {
      throw new Error(`test database is missing ${table}.${column} — the harness, not the code, is wrong`)
    }
  }
}

/**
 * Splits SQL into statements on semicolons that actually separate statements.
 *
 * Naively splitting on ";" corrupts this DDL: a semicolon inside a `--` comment chopped statements
 * in half and left prose being executed as SQL, which silently lost
 * `bookings.identity_check_due_at` — the one column the whole feature turns on. Comments and
 * dollar-quoted blocks ($$ ... $$, which legitimately contain semicolons) are both respected.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = []
  let buf = ""
  let inDollar = false, inComment = false, inString = false

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1]

    if (inComment) { if (c === "\n") { inComment = false; buf += c } ; continue }
    if (inString) { buf += c; if (c === "'") inString = false; continue }
    if (!inDollar && c === "-" && next === "-") { inComment = true; i++; continue }
    if (c === "$" && next === "$") { inDollar = !inDollar; buf += "$$"; i++; continue }
    if (!inDollar && c === "'") { inString = true; buf += c; continue }
    if (!inDollar && c === ";") { if (buf.trim()) out.push(buf.trim()); buf = ""; continue }
    buf += c
  }

  if (buf.trim()) out.push(buf.trim())
  return out
}

/** Mirrors the ALTER TYPE calls in scripts/ensure-referrals.mjs main(). */
const ENUM_ADDITIONS: Array<[string, string]> = [
  ["user_role", "affiliate"],
  ["booking_status", "client_no_show"],
  ["booking_status", "cleaner_no_show"],
  ["notification_type", "job_taken"],
  ["notification_type", "payment_automation_failed"],
  ["blog_post_status", "scheduled"],
  ["email_send_status", "clicked"],
  ["email_send_status", "complained"],
]

/**
 * Lifts the DDL out of scripts/ensure-referrals.mjs rather than keeping a copy.
 *
 * The script calls main() at import time, so it cannot simply be imported. Slicing the template
 * literal is safe precisely because that DDL is guaranteed to contain NO backtick: one inside a SQL
 * comment once ended the string early and broke a production deploy, and the rule since is that it
 * never contains another. A copy here would be free to drift from what production actually runs,
 * which is the whole thing this harness is trying not to do.
 */
function readEnsureScriptDDL(root: string): string {
  const file = fs.readFileSync(path.join(root, "scripts", "ensure-referrals.mjs"), "utf8")
  const start = file.indexOf("const DDL = `")
  if (start === -1) throw new Error("could not find `const DDL` in scripts/ensure-referrals.mjs")
  const from = start + "const DDL = `".length
  const end = file.indexOf("`", from)
  if (end === -1) throw new Error("could not find the end of the DDL template literal")
  return file.slice(from, end)
}
