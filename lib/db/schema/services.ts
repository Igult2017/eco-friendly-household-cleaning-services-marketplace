import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  time,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { providers } from "./providers"

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    iconUrl: text("icon_url"),
    baseEcoPoints: integer("base_eco_points").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("service_categories_slug_idx").on(t.slug)]
)

export const providerServices = pgTable(
  "provider_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id), // primary category (= categoryIds[0]); kept for joins/search
    // A service can belong to MULTIPLE built-in categories (findable under each) plus free-text
    // custom labels (shown on the profile; not client-searchable).
    categoryIds: jsonb("category_ids").$type<string[]>().default([]),
    customCategories: jsonb("custom_categories").$type<string[]>().default([]),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    basePrice: integer("base_price").notNull(), // euro cents
    priceUnit: varchar("price_unit", { length: 20 }).notNull().default("per_job"), // per_job | per_hour | per_sqft
    minDurationMinutes: integer("min_duration_minutes").notNull().default(60),
    maxDurationMinutes: integer("max_duration_minutes"),
    ecoProductsUsed: jsonb("eco_products_used").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("provider_services_provider_idx").on(t.providerId),
    index("provider_services_category_idx").on(t.categoryId),
  ]
)

// Cleaner-defined paid add-ons (e.g. oven cleaning, ironing) selectable at booking.
export const providerAddons = pgTable(
  "provider_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    priceCents: integer("price_cents").notNull(), // euro cents
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("provider_addons_provider_idx").on(t.providerId)]
)

export const providerAvailability = pgTable(
  "provider_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 6=Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("provider_availability_provider_idx").on(t.providerId)]
)

export const providerBlackoutDates = pgTable(
  "provider_blackout_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 200 }),
  },
  (t) => [index("blackout_provider_date_idx").on(t.providerId, t.date)]
)

export type ServiceCategory = typeof serviceCategories.$inferSelect
export type ProviderService = typeof providerServices.$inferSelect
export type NewProviderService = typeof providerServices.$inferInsert
export type ProviderAddon = typeof providerAddons.$inferSelect
export type NewProviderAddon = typeof providerAddons.$inferInsert
export type ProviderAvailability = typeof providerAvailability.$inferSelect
