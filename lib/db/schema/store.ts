import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core"

// Eco-store: admin-curated affiliate storefront. The admin posts recommended products and business
// "starter packs"; the public browses them and clicks out to the brand/Amazon via affiliate links.
// No on-platform purchase — every listing links OUT, so there's no order/payment model here.

export const storeProductTypeEnum = pgEnum("store_product_type", ["product", "starter_pack"])
export const storeProductStatusEnum = pgEnum("store_product_status", ["draft", "published"])

export const storeProducts = pgTable(
  "store_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: storeProductTypeEnum("type").notNull().default("product"),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    brand: varchar("brand", { length: 160 }),
    imageUrl: text("image_url"),
    affiliateUrl: text("affiliate_url").notNull(),
    // Optional reference price (display only — the real price lives on the external store).
    priceCents: integer("price_cents"),
    currency: varchar("currency", { length: 3 }),
    // Starter-pack selling points, shown as a benefits list.
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
    category: varchar("category", { length: 100 }),
    // Membership: a product can belong to a starter-pack row (self-reference) — packs are titled
    // LISTS of products ("Cleaners starter pack", "Top 10 eco products…"), rendered as one section.
    packId: uuid("pack_id"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    featured: boolean("featured").notNull().default(false),
    status: storeProductStatusEnum("status").notNull().default("draft"),
    // Outbound-click counter (incremented by the /api/store/go redirect) for interest analytics.
    clicks: integer("clicks").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("store_products_slug_idx").on(t.slug),
    index("store_products_status_idx").on(t.status),
    index("store_products_type_idx").on(t.type),
    index("store_products_featured_idx").on(t.featured),
  ]
)

export type StoreProduct = typeof storeProducts.$inferSelect
export type NewStoreProduct = typeof storeProducts.$inferInsert
