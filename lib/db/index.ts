import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Use the POOLER URL at runtime (PgBouncer Transaction mode)
// connection_limit=1 is set in the URL query param
const client = postgres(process.env.DATABASE_POOLER_URL!, {
  prepare: false, // Required for PgBouncer Transaction mode
})

export const db = drizzle(client, { schema })
export type DB = typeof db
