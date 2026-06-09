import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Connects to your Hostinger VPS PostgreSQL instance.
// For production, add ?ssl=true to the URL and set up PgBouncer on the VPS
// to handle Vercel's serverless connection bursts.
const client = postgres(
  process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/dorix",
  { max: 1, prepare: false }
)

export const db = drizzle(client, { schema })
export type DB = typeof db
