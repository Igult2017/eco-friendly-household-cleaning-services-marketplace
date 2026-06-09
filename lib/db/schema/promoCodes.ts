import { pgTable, uuid, text, varchar, integer, boolean, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core"
import { users } from "./users"
import { bookings } from "./bookings"

export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"])

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),  // cents for fixed; 1-100 for percentage
  minOrderCents: integer("min_order_cents").notNull().default(0),
  maxDiscountCents: integer("max_discount_cents"),     // cap for percentage discounts
  maxUses: integer("max_uses"),                        // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("promo_codes_code_idx").on(t.code),
])

export const promoCodeUsages = pgTable("promo_code_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  promoCodeId: uuid("promo_code_id").notNull().references(() => promoCodes.id),
  userId: text("user_id").notNull().references(() => users.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  discountAmount: integer("discount_amount").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("promo_usage_code_idx").on(t.promoCodeId),
  index("promo_usage_user_idx").on(t.userId),
])

export type PromoCode = typeof promoCodes.$inferSelect
export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect
