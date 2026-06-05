import { pgTable, uuid, text, varchar, integer, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core"

export const errorSeverityEnum = pgEnum("error_severity", ["info", "warning", "error", "critical"])

export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    message: text("message").notNull(),
    stack: text("stack"),
    route: varchar("route", { length: 500 }),
    method: varchar("method", { length: 10 }),
    statusCode: integer("status_code"),
    userId: text("user_id"),
    severity: errorSeverityEnum("severity").notNull().default("error"),
    context: jsonb("context"),
    sentryEventId: varchar("sentry_event_id", { length: 100 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("error_logs_created_at_idx").on(t.createdAt),
    index("error_logs_severity_idx").on(t.severity),
    index("error_logs_resolved_at_idx").on(t.resolvedAt),
  ]
)

export type ErrorLog = typeof errorLogs.$inferSelect
export type NewErrorLog = typeof errorLogs.$inferInsert
