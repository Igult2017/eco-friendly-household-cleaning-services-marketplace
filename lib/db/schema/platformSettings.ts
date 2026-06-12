import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core"

export const platformSettings = pgTable("platform_settings", {
  key:       varchar("key",   { length: 100 }).primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type PlatformSetting    = typeof platformSettings.$inferSelect
export type NewPlatformSetting = typeof platformSettings.$inferInsert
