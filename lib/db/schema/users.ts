import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"

export const userRoleEnum = pgEnum("user_role", ["customer", "provider", "admin", "affiliate"])

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // Clerk user ID
    email: varchar("email", { length: 320 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 30 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
    role: userRoleEnum("role").notNull().default("customer"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    gdprConsentAt: timestamp("gdpr_consent_at", { withTimezone: true }),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    // Opt-out for non-critical emails (booking reminders + review requests). Critical transactional
    // emails (booking/payment confirmations) are always sent; in-app notifications are unaffected.
    emailReminders: boolean("email_reminders").notNull().default(true),
    dualRoleEnabled: boolean("dual_role_enabled").notNull().default(false),
    locale: varchar("locale", { length: 5 }), // detected at onboarding (IP country -> language); used for localized emails
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_role_idx").on(t.role),
  ]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
