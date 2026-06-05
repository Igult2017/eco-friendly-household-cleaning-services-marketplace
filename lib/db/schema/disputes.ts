import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { bookings } from "./bookings"

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "under_review",
  "resolved_customer",
  "resolved_provider",
  "escalated",
  "closed",
])

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    openedBy: text("opened_by")
      .notNull()
      .references(() => users.id),
    respondedBy: text("responded_by").references(() => users.id),
    assignedAdminId: text("assigned_admin_id").references(() => users.id),
    status: disputeStatusEnum("status").notNull().default("open"),
    reason: varchar("reason", { length: 100 }).notNull(),
    description: text("description").notNull(),
    evidenceUrls: jsonb("evidence_urls").$type<string[]>().default([]),
    resolution: text("resolution"),
    resolutionAmount: integer("resolution_amount"), // refund in cents
    stripeDisputeId: varchar("stripe_dispute_id", { length: 100 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("disputes_booking_idx").on(t.bookingId),
    index("disputes_status_idx").on(t.status),
    index("disputes_opened_by_idx").on(t.openedBy),
  ]
)

export const disputeMessages = pgTable(
  "dispute_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dispute_messages_dispute_idx").on(t.disputeId)]
)

export type Dispute = typeof disputes.$inferSelect
export type NewDispute = typeof disputes.$inferInsert
export type DisputeMessage = typeof disputeMessages.$inferSelect
