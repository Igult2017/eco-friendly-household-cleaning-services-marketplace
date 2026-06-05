import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Connects to your Hostinger VPS PostgreSQL instance.
// For production, add ?ssl=true to the URL and set up PgBouncer on the VPS
// to handle Vercel's serverless connection bursts.
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,     // one connection per serverless function instance
  prepare: false, // set to true if NOT using PgBouncer
})

export const db = drizzle(client, { schema })
export type DB = typeof db
