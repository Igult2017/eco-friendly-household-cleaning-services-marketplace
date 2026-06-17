import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"

export const ecoLevelEnum = pgEnum("eco_level", [
  "basic",
  "certified",
  "premium",
  "zero_impact",
])

export const verificationStatusEnum = pgEnum("verification_status", [
  "not_started",
  "pending",
  "verified",
  "rejected",
  "requires_resubmission",
])

export const payoutScheduleEnum = pgEnum("payout_schedule", [
  "weekly",
  "biweekly",
  "monthly",
])

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    businessName: varchar("business_name", { length: 200 }).notNull(),
    bio: text("bio"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    // location geography(Point,4326) added via raw SQL migration
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 2 }).notNull(),
    serviceRadiusKm: integer("service_radius_km").notNull().default(25),
    ecoLevel: ecoLevelEnum("eco_level").notNull().default("basic"),
    ecoScore: integer("eco_score").notNull().default(0),
    certifications: jsonb("certifications").$type<string[]>().default([]),
    carbonOffsetEnabled: boolean("carbon_offset_enabled").notNull().default(false),
    // Cleaner-set loyalty discount (%) applied to their recurring bookings.
    recurringDiscountPct: integer("recurring_discount_pct").notNull().default(0),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("not_started"),
    stripeAccountId: varchar("stripe_account_id", { length: 64 }),
    stripeAccountStatus: varchar("stripe_account_status", { length: 32 }),
    payoutSchedule: payoutScheduleEnum("payout_schedule").notNull().default("weekly"),
    isApproved: boolean("is_approved").notNull().default(false),
    isSuspended: boolean("is_suspended").notNull().default(false),
    suspendedReason: text("suspended_reason"),
    averageRating: doublePrecision("average_rating").default(0),
    totalReviews: integer("total_reviews").notNull().default(0),
    totalJobsCompleted: integer("total_jobs_completed").notNull().default(0),
    profilePhotoUrl: text("profile_photo_url"),
    galleryUrls: jsonb("gallery_urls").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("providers_user_id_idx").on(t.userId),
    uniqueIndex("providers_slug_idx").on(t.slug),
    uniqueIndex("providers_stripe_account_idx").on(t.stripeAccountId),
    index("providers_city_idx").on(t.city),
    index("providers_eco_level_idx").on(t.ecoLevel),
    index("providers_is_approved_idx").on(t.isApproved),
  ]
)

export type Provider = typeof providers.$inferSelect
export type NewProvider = typeof providers.$inferInsert
