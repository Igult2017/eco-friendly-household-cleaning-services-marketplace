import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { serviceCategories } from "./services"

export const jobStatusEnum = pgEnum("job_status", [
  "open",
  "bidding",
  "assigned",
  "completed",
  "cancelled",
  "expired",
])

export const jobPosts = pgTable(
  "job_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    categoryId: uuid("category_id").references(() => serviceCategories.id),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    status: jobStatusEnum("status").notNull().default("open"),
    budgetMin: integer("budget_min"),  // cents
    budgetMax: integer("budget_max"),  // cents
    desiredDate: date("desired_date"),
    desiredTimeRange: jsonb("desired_time_range")
      .$type<{ start: string; end: string }>(),
    serviceAddress: jsonb("service_address")
      .$type<{
        line1: string
        city: string
        state?: string
        postalCode: string
        country: string
      }>()
      .notNull(),
    serviceLatitude: doublePrecision("service_latitude").notNull(),
    serviceLongitude: doublePrecision("service_longitude").notNull(),
    // service_location geography(Point,4326) added via raw SQL migration
    radiusKm: integer("radius_km").notNull().default(25),
    ecoRequirements: jsonb("eco_requirements").$type<string[]>().default([]),
    // Recurring cadence the client wants (weekly|biweekly|monthly), null = one-time. Shown to cleaners
    // on the job board so they know it's repeat work before bidding.
    recurringFrequency: varchar("recurring_frequency", { length: 12 }),
    acceptedBidId: uuid("accepted_bid_id"),
    // Poster's client IP — self-bid fraud prevention (hide/block the poster's own jobs even from a
    // second account on the same connection).
    postedIp: varchar("posted_ip", { length: 64 }),
    viewCount: integer("view_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("job_posts_customer_idx").on(t.customerId),
    index("job_posts_status_idx").on(t.status),
    index("job_posts_expires_at_idx").on(t.expiresAt),
  ]
)

export type JobPost = typeof jobPosts.$inferSelect
export type NewJobPost = typeof jobPosts.$inferInsert
export type JobStatus = typeof jobStatusEnum.enumValues[number]
