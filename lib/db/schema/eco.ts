import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { providers } from "./providers"
import { bookings } from "./bookings"

export const ecoCertifications = pgTable(
  "eco_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    issuingBody: varchar("issuing_body", { length: 200 }),
    certificationNumber: varchar("certification_number", { length: 100 }),
    documentUrl: text("document_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: date("expires_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("eco_certs_provider_idx").on(t.providerId)]
)

export const carbonOffsetContributions = pgTable(
  "carbon_offset_contributions",
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
    amount: integer("amount").notNull(), // cents
    offsetProvider: varchar("offset_provider", { length: 100 }),
    offsetCertificateUrl: text("offset_certificate_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("carbon_booking_idx").on(t.bookingId)]
)

export const providerIdentityVerifications = pgTable(
  "provider_identity_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id),
    stripeVerificationSessionId: varchar("stripe_session_id", { length: 100 }),
    status: varchar("status", { length: 30 }).notNull().default("not_started"),
    documentType: varchar("document_type", { length: 50 }),
    documentFrontUrl: text("document_front_url"),
    documentBackUrl: text("document_back_url"),
    selfieUrl: text("selfie_url"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("identity_provider_idx").on(t.providerId)]
)

export type EcoCertification = typeof ecoCertifications.$inferSelect
export type ProviderIdentityVerification = typeof providerIdentityVerifications.$inferSelect
