import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { providers } from "./providers"
import { providerServices } from "./services"

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment",
  "payment_authorized",
  "confirmed",
  "in_progress",
  "pending_capture",  // work done by provider, awaiting Inngest capture
  "completed",
  "cancelled",
  "disputed",
  "refunded",
])

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNumber: varchar("booking_number", { length: 20 }).notNull(), // BK-2024-000001
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id),
    serviceId: uuid("service_id").references(() => providerServices.id),
    status: bookingStatusEnum("status").notNull().default("pending_payment"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
    actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
    actualEndAt: timestamp("actual_end_at", { withTimezone: true }),
    serviceAddress: jsonb("service_address")
      .$type<{
        line1: string
        line2?: string
        city: string
        state?: string
        postalCode: string
        country: string
      }>()
      .notNull(),
    serviceLatitude: doublePrecision("service_latitude"),
    serviceLongitude: doublePrecision("service_longitude"),
    specialInstructions: text("special_instructions"),
    ecoOptionsSelected: jsonb("eco_options").$type<string[]>().default([]),
    platformFeePercent: integer("platform_fee_pct").notNull().default(15),
    subtotalAmount: integer("subtotal_amount").notNull(),   // provider's quoted price (cents)
    platformFeeAmount: integer("platform_fee_amount").notNull(), // commission, DEDUCTED from the provider payout (cents)
    totalAmount: integer("total_amount").notNull(),         // customer is charged this
    providerPayout: integer("provider_payout").notNull(),   // provider receives this
    carbonOffsetAmount: integer("carbon_offset_amount").notNull().default(0),
    completionPhotoUrls: jsonb("completion_photos").$type<string[]>().default([]),
    beforePhotoUrls: jsonb("before_photo_urls").$type<string[]>().default([]),
    promoCodeId: uuid("promo_code_id"),  // no FK here to avoid circular dep — enforced in API
    discountAmount: integer("discount_amount").notNull().default(0),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
    // Dual completion confirmation — payment releases only when BOTH are set (or an admin releases).
    providerCompletedAt: timestamp("provider_completed_at", { withTimezone: true }),
    clientConfirmedAt: timestamp("client_confirmed_at", { withTimezone: true }),
    paymentReleasedBy: varchar("payment_released_by", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_number_idx").on(t.bookingNumber),
    uniqueIndex("bookings_provider_scheduled_idx").on(t.providerId, t.scheduledAt),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_provider_idx").on(t.providerId),
    index("bookings_status_idx").on(t.status),
    index("bookings_scheduled_at_idx").on(t.scheduledAt),
  ]
)

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert
export type BookingStatus = typeof bookingStatusEnum.enumValues[number]
