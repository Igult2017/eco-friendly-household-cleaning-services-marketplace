import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use the DIRECT URL for migrations (not the pooler)
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
