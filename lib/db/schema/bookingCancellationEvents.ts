import { pgTable, uuid, text, varchar, integer, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core"
import { bookings } from "./bookings"
import { users } from "./users"

export const cancellationActorEnum = pgEnum("cancellation_actor", ["client", "cleaner", "admin", "system"])

export const cancellationActionEnum = pgEnum("cancellation_action", [
  "cancelled",
  "client_no_show",
  "cleaner_no_show",
  "admin_override",
])

// Immutable audit trail for every cancellation / no-show outcome — required for dispute resolution
// and regulatory defensibility. Never updated after insert; a correction is a NEW row (e.g. an
// admin_override event), not an edit of the original.
export const bookingCancellationEvents = pgTable(
  "booking_cancellation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id),
    actorUserId: text("actor_user_id").references(() => users.id), // null for "system"
    actorRole: cancellationActorEnum("actor_role").notNull(),
    action: cancellationActionEnum("action").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(), // snapshot at event time
    statusBefore: varchar("status_before", { length: 32 }).notNull(),
    cancellationFeeAmount: integer("cancellation_fee_amount").notNull().default(0),
    travelCompensationAmount: integer("travel_compensation_amount").notNull().default(0),
    refundAmount: integer("refund_amount").notNull().default(0),
    isAdminOverride: boolean("is_admin_override").notNull().default(false),
    overrideReason: text("override_reason"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_cancellation_events_booking_idx").on(t.bookingId),
    index("booking_cancellation_events_created_idx").on(t.createdAt),
  ]
)

export type BookingCancellationEvent = typeof bookingCancellationEvents.$inferSelect
export type NewBookingCancellationEvent = typeof bookingCancellationEvents.$inferInsert
