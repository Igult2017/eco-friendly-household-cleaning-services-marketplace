import { pgTable, uuid, text, varchar, smallint, pgEnum, timestamp, jsonb, check, index } from "drizzle-orm/pg-core"
import { users } from "./users"
import { providers } from "./providers"
import { providerServices } from "./services"
import { sql } from "drizzle-orm"

export const recurringFrequencyEnum = pgEnum("recurring_frequency", ["weekly", "biweekly", "monthly"])
export const recurringStatusEnum = pgEnum("recurring_status", ["active", "paused", "cancelled"])

export const recurringSchedules = pgTable("recurring_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id),
  serviceId: uuid("service_id").notNull().references(() => providerServices.id),
  frequency: recurringFrequencyEnum("frequency").notNull(),
  dayOfWeek: smallint("day_of_week").notNull(),
  preferredTime: text("preferred_time").notNull(),
  serviceAddress: jsonb("service_address").notNull(),
  ecoOptions: jsonb("eco_options").default([]),
  specialInstructions: text("special_instructions"),
  stripePaymentMethodId: varchar("stripe_payment_method_id", { length: 100 }),
  timezone: text("timezone").notNull().default("Europe/Amsterdam"),
  status: recurringStatusEnum("status").notNull().default("active"),
  // Timestamp of the customer's affirmative consent to recurring auto-charge (US auto-renewal laws /
  // Click-to-Cancel + EU). The create API requires explicit consent before a schedule can be created.
  autoRenewConsentAt: timestamp("auto_renew_consent_at", { withTimezone: true }),
  nextBookingAt: timestamp("next_booking_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("recurring_customer_idx").on(t.customerId),
  index("recurring_provider_idx").on(t.providerId),
  check("day_of_week_range", sql`${t.dayOfWeek} >= 0 AND ${t.dayOfWeek} <= 6`),
])

export type RecurringSchedule = typeof recurringSchedules.$inferSelect
export type NewRecurringSchedule = typeof recurringSchedules.$inferInsert
