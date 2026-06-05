import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { providers } from "./providers"
import { bookings } from "./bookings"

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id),
    overallRating: integer("overall_rating").notNull(),       // 1–5
    cleanlinessRating: integer("cleanliness_rating"),
    punctualityRating: integer("punctuality_rating"),
    ecoComplianceRating: integer("eco_compliance_rating"),
    communicationRating: integer("communication_rating"),
    title: varchar("title", { length: 200 }),
    body: text("body"),
    isPublic: boolean("is_public").notNull().default(true),
    isFlagged: boolean("is_flagged").notNull().default(false),
    adminNote: text("admin_note"),
    providerResponse: text("provider_response"),
    providerRespondedAt: timestamp("provider_responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_booking_idx").on(t.bookingId), // one review per booking
    index("reviews_provider_idx").on(t.providerId),
    index("reviews_customer_idx").on(t.customerId),
    index("reviews_rating_idx").on(t.overallRating),
  ]
)

export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
