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
// connection serialized every DB query across all users. 15 lets ~15 queries run concurrently.
// Keep (replicas × max) under Postgres max_connections (default 100) if you scale out replicas.
const client = postgres(resolveDbUrl(), { max: 15, prepare: false })

export const db = drizzle(client, { schema })
export type DB = typeof db
