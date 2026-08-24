import { pgTable, uuid, text, varchar, integer, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core"
import { bookings } from "./bookings"
import { users } from "./users"

export const paymentEventKindEnum = pgEnum("payment_event_kind", [
  "authorized",
  "captured",
  "refunded",
  "transferred",
  "payout_succeeded",
  "payout_failed",
])

// Append-only record of every real money movement — never updated after insert, same convention as
// bookingCancellationEvents. The single place "what actually happened to this booking's money, in
// what order" can be answered without cross-referencing several tables or Stripe's own dashboard.
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id), // null for referral/affiliate payouts
    userId: text("user_id").references(() => users.id), // who the money moved for
    kind: paymentEventKindEnum("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    stripeObjectId: varchar("stripe_object_id", { length: 128 }), // charge/transfer/payout id, for cross-checking against Stripe's own dashboard
    status: varchar("status", { length: 32 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payment_events_booking_idx").on(t.bookingId),
    index("payment_events_user_idx").on(t.userId),
    index("payment_events_created_at_idx").on(t.createdAt),
  ]
)

export type PaymentEvent = typeof paymentEvents.$inferSelect
export type NewPaymentEvent = typeof paymentEvents.$inferInsert
