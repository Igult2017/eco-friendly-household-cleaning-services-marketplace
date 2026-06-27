import * as Sentry from "@sentry/nextjs"

export async function register() {
  // Initialize Sentry for the active server runtime. These modules call Sentry.init (a no-op until
  // SENTRY_DSN is set). The build plugin can't auto-wire this because register() also runs migrations.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }

  // Boot migrations — Node.js runtime only, never Edge or the browser.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // Under cluster mode (cluster-server.cjs) only the first worker runs boot migrations;
  // the rest are told to skip so we don't fire N concurrent migrate() calls on startup.
  if (process.env.SKIP_BOOT_MIGRATE === "1") return

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
    console.error("[migrate] Migration failed — app will start but DB may be stale:", err)
  } finally {
    await client.end()
  }
}

// Capture errors thrown in nested React Server Components, route handlers, and server actions
// (Next 15/16 forwards them here). No-op until a DSN is configured.
export const onRequestError = Sentry.captureRequestError
