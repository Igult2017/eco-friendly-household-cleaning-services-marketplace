export async function register() {
  // Only run on the Node.js runtime — never on Edge or in the browser
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { migrate } = await import("drizzle-orm/postgres-js/migrator")
  const { drizzle } = await import("drizzle-orm/postgres-js")
  const { default: postgres } = await import("postgres")

  // Always use the direct (non-pooler) URL for migrations.
  // PgBouncer transaction mode does not support the advisory locks Drizzle needs.
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[migrate] DATABASE_URL is not set — skipping migrations")
    return
  }

  const migrationsFolder =
    process.env.NODE_ENV === "production"
      ? "/app/drizzle/migrations"
      : "./drizzle/migrations"

  const client = postgres(url, { max: 1, idle_timeout: 20 })
  try {
    await migrate(drizzle(client), { migrationsFolder })
    console.log("[migrate] Migrations applied successfully")
  } catch (err) {
    console.error("[migrate] Migration failed:", err)
    // Crash hard in production so the container restarts rather than serving
    // against a schema that doesn't match the code.
    if (process.env.NODE_ENV === "production") throw err
  } finally {
    await client.end()
  }
}
