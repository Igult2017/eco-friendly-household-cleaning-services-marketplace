/**
 * Seed script — run with: npx tsx lib/db/seed.ts
 * Seeds core reference data. Safe to re-run (upsert on slug).
 */
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { serviceCategories } from "./schema"

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })
const db = drizzle(client)

const CATEGORIES = [
  {
    name: "Regular Cleaning",
    slug: "regular-cleaning",
    description: "Routine maintenance cleaning: vacuuming, mopping, surfaces, bathrooms, kitchen.",
    iconUrl: "🌿",
    baseEcoPoints: 10,
    sortOrder: 1,
  },
  {
    name: "Deep Cleaning",
    slug: "deep-cleaning",
    description: "Thorough top-to-bottom clean covering all surfaces, appliances, and hidden areas.",
    iconUrl: "✨",
    baseEcoPoints: 20,
    sortOrder: 2,
  },
  {
    name: "Move-in / Move-out",
    slug: "move-cleaning",
    description: "End-of-tenancy or pre-move-in clean to prepare a property for new occupants.",
    iconUrl: "📦",
    baseEcoPoints: 25,
    sortOrder: 3,
  },
  {
    name: "Office Cleaning",
    slug: "office-cleaning",
    description: "Professional eco-cleaning for offices, co-working spaces, and commercial premises.",
    iconUrl: "🏢",
    baseEcoPoints: 15,
    sortOrder: 4,
  },
  {
    name: "Laundry",
    slug: "laundry",
    description: "Washing, drying, folding and ironing using eco-certified detergents.",
    iconUrl: "👕",
    baseEcoPoints: 8,
    sortOrder: 5,
  },
  {
    name: "Window Cleaning",
    slug: "window-cleaning",
    description: "Interior and exterior window cleaning with streak-free, plant-based solutions.",
    iconUrl: "🪟",
    baseEcoPoints: 12,
    sortOrder: 6,
  },
  {
    name: "Appliance Cleaning",
    slug: "appliance-cleaning",
    description: "Deep cleaning of ovens, fridges, dishwashers, and washing machines.",
    iconUrl: "🔧",
    baseEcoPoints: 18,
    sortOrder: 7,
  },
]

async function seed() {
  console.log("🌱 Seeding service categories...")

  for (const cat of CATEGORIES) {
    await db
      .insert(serviceCategories)
      .values({ ...cat, isActive: true })
      .onConflictDoUpdate({
        target: serviceCategories.slug,
        set: {
          name: cat.name,
          description: cat.description,
          iconUrl: cat.iconUrl,
          baseEcoPoints: cat.baseEcoPoints,
          sortOrder: cat.sortOrder,
          isActive: true,
        },
      })
    console.log(`  ✅ ${cat.name}`)
  }

  console.log("✨ Seed complete.")
  await client.end()
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
