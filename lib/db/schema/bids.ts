import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  time,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { providers } from "./providers"
import { jobPosts } from "./jobs"
import { bookings } from "./bookings"

export const bidStatusEnum = pgEnum("bid_status", [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
])

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id),
    status: bidStatusEnum("status").notNull().default("pending"),
    amount: integer("amount").notNull(), // euro cents
    message: text("message"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    proposedDate: date("proposed_date"),
    proposedTimeStart: time("proposed_time_start"),
    bookingId: uuid("booking_id").references(() => bookings.id), // set when accepted
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bids_provider_job_idx").on(t.providerId, t.jobPostId), // one bid per provider per job
    index("bids_job_post_idx").on(t.jobPostId),
    index("bids_provider_idx").on(t.providerId),
    index("bids_status_idx").on(t.status),
  ]
)

export type Bid = typeof bids.$inferSelect
export type NewBid = typeof bids.$inferInsert
export type BidStatus = typeof bidStatusEnum.enumValues[number]
