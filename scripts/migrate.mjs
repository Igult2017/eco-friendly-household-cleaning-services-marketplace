// Standalone migration runner — used by the Docker migrator service.
// Runs drizzle migrate() against the direct DB URL (not PgBouncer).
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("[migrate] DATABASE_URL is not set")
  process.exit(1)
}

const client = postgres(url, { max: 1 })
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle/migrations" })
  console.log("[migrate] All migrations applied successfully")
} catch (err) {
  console.error("[migrate] Migration failed:", err)
  process.exit(1)
} finally {
  await client.end()
}
