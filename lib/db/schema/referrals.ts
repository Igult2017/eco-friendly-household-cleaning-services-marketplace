import { pgTable, uuid, text, varchar, integer, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core"
import { users } from "./users"
import { bookings } from "./bookings"

export const referralStatusEnum = pgEnum("referral_status", ["pending", "active", "invalid"])
export const commissionStatusEnum = pgEnum("commission_status", ["pending", "credited", "cancelled"])

// One code per user — auto-generated on first dashboard visit
export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique().references(() => users.id),
  code: varchar("code", { length: 20 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("referral_codes_user_idx").on(t.userId),
  uniqueIndex("referral_codes_code_idx").on(t.code),
])

// One row per referred user — created when they complete onboarding
export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: text("referrer_id").notNull().references(() => users.id),
  referredId: text("referred_id").notNull().unique().references(() => users.id),
  code: varchar("code", { length: 20 }).notNull(),
  status: referralStatusEnum("status").notNull().default("pending"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  totalCommissionEarnedCents: integer("total_commission_earned_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("referrals_referrer_idx").on(t.referrerId),
  uniqueIndex("referrals_referred_idx").on(t.referredId),
])

// One row per qualifying booking — 5% of subtotal credited to referrer
export const referralCommissions = pgTable("referral_commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  referralId: uuid("referral_id").notNull().references(() => referrals.id),
  bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id),
  referrerId: text("referrer_id").notNull().references(() => users.id),
  bookingAmountCents: integer("booking_amount_cents").notNull(),
  commissionCents: integer("commission_cents").notNull(),
  status: commissionStatusEnum("status").notNull().default("pending"),
  creditedAt: timestamp("credited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ref_commissions_booking_idx").on(t.bookingId),
  index("ref_commissions_referral_idx").on(t.referralId),
  index("ref_commissions_referrer_idx").on(t.referrerId),
])

// Credit wallet — one row per user, upserted whenever commission is credited
export const referralCredits = pgTable("referral_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique().references(() => users.id),
  balanceCents: integer("balance_cents").notNull().default(0),
  lifetimeEarnedCents: integer("lifetime_earned_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("referral_credits_user_idx").on(t.userId),
])

export type ReferralCode = typeof referralCodes.$inferSelect
export type Referral = typeof referrals.$inferSelect
export type ReferralCommission = typeof referralCommissions.$inferSelect
export type ReferralCredit = typeof referralCredits.$inferSelect
