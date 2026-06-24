import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Validate the URL before passing to postgres() so a missing or placeholder
// DATABASE_URL during `next build` (static page collection) doesn't crash the
// module at load time. At runtime the real URL is always provided.
function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL ?? ""
  try {
    const parsed = new URL(url)
    if (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") {
      return url
    }
  } catch {
    // invalid URL — fall through to placeholder
  }
  return "postgres://placeholder:placeholder@localhost:5432/dorix"
}

// Pool size: this app runs as a long-lived server (not per-request serverless), so a single
// connection serialized every DB query across all users. Under cluster mode each worker gets
// DB_POOL_MAX (set by cluster-server.cjs to budget/workers) so total connections across all
// workers stay under Postgres max_connections (default 100). Defaults to 15 when unset.
const poolMax = Number.parseInt(process.env.DB_POOL_MAX || "15", 10)
const client = postgres(resolveDbUrl(), { max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 15, prepare: false })

export const db = drizzle(client, { schema })
export type DB = typeof db
