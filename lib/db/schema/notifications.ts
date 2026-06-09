import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"

export const notificationTypeEnum = pgEnum("notification_type", [
  "new_job_request",
  "bid_received",
  "bid_accepted",
  "bid_rejected",
  "booking_confirmed",
  "booking_reminder",
  "booking_completed",
  "booking_cancelled",
  "payment_received",
  "payout_processed",
  "dispute_opened",
  "dispute_resolved",
  "review_received",
  "provider_approved",
  "provider_rejected",
  "provider_suspended",
  "provider_unsuspended",
  "identity_verified",
  "new_message",
])

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    link: varchar("link", { length: 500 }),
    isRead: boolean("is_read").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_unread_idx").on(t.userId, t.isRead),
    index("notifications_created_at_idx").on(t.createdAt),
  ]
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
