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
  date,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { providers } from "./providers"
import { bookings } from "./bookings"

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "refunded",
  "partially_refunded",
  "failed",
  "disputed",
])

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "paid",
  "failed",
])

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amount: integer("amount").notNull(), // total charged to customer (cents)
    capturedAmount: integer("captured_amount"),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("eur"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    failureCode: varchar("failure_code", { length: 50 }),
    failureMessage: text("failure_message"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_intent_idx").on(t.stripePaymentIntentId),
    index("payments_booking_idx").on(t.bookingId),
    index("payments_customer_idx").on(t.customerId),
    index("payments_status_idx").on(t.status),
  ]
)

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id),
    stripeTransferId: varchar("stripe_transfer_id", { length: 100 }),
    stripePayoutId: varchar("stripe_payout_id", { length: 100 }),
    status: payoutStatusEnum("status").notNull().default("pending"),
    amount: integer("amount").notNull(), // cents
    currency: varchar("currency", { length: 3 }).notNull().default("eur"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    bookingIds: jsonb("booking_ids").$type<string[]>().notNull(),
    failureReason: text("failure_reason"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payouts_provider_idx").on(t.providerId),
    index("payouts_status_idx").on(t.status),
    index("payouts_period_idx").on(t.periodStart, t.periodEnd),
  ]
)

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type Payout = typeof payouts.$inferSelect
export type NewPayout = typeof payouts.$inferInsert
