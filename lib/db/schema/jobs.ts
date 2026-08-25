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
    // "standard" = normal bidding flow. "take_job" = emergency/instant-assignment — no bidding, first
    // eligible provider to claim it via /api/jobs/[id]/take is assigned immediately. Plain varchar
    // (like recurringFrequency below), not a pg enum — the drizzle migration journal is drifted, so a
    // new enum type would need its own DO-block DDL for zero benefit over app-level zod validation.
    jobType: varchar("job_type", { length: 12 }).notNull().default("standard"),
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
    // Weekday(s) the client wants it on (0=Sun..6=Sat) — stated intent, same as recurringFrequency;
    // carried into a booking's requestedDays once a bid is accepted / a Take Job is claimed.
    recurringDays: jsonb("recurring_days").$type<number[]>().default([]),
    // Expected hours of work (stored as minutes) — lets cleaners compute an hourly bid from the budget.
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    acceptedBidId: uuid("accepted_bid_id"),
    // Set the moment a bid is accepted / a Take Job claim wins — lets the hourly sweep
    // (jobAssignmentSweeper) find a job stuck "assigned" with no real booking ever created (e.g. the
    // client abandoned payment) and free it, instead of it staying locked forever.
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
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
