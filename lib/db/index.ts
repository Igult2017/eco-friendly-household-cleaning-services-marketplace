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

const client = postgres(resolveDbUrl(), { max: 1, prepare: false })

export const db = drizzle(client, { schema })
export type DB = typeof db
