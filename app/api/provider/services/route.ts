import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, serviceCategories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { logError } from "@/lib/utils/logError"
import { getMinHourlyRateCents } from "@/lib/platform/settings"

const serviceSchema = z.object({
  // At least one built-in category (so clients can find this service); the first is the primary.
  categoryIds: z.array(z.string().uuid()).min(1).max(8),
  // Optional free-text labels not in the built-in list (shown on the profile, not searchable).
  customCategories: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  // null = "ask on booking" — no fixed price, excluded from instant/direct booking.
  basePrice: z.number().int().min(100).nullable(),
  // Optional upper end of a price range ("€20-25/hour") — null/omitted means no range, just
  // basePrice as a single fixed rate. Only meaningful for priceUnit "per_hour".
  basePriceMax: z.number().int().min(100).nullable().optional(),
  priceUnit: z.enum(["per_job", "per_hour", "per_sqft"]),
  minDurationMinutes: z.number().int().min(30).max(480),
}).refine(
  (d) => d.basePriceMax == null || d.basePrice == null || d.basePriceMax >= d.basePrice,
  { message: "The maximum can't be lower than the minimum.", path: ["basePriceMax"] },
)

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Categories are global — always return them so the dropdown is never mysteriously empty,
    // even before the user has a cleaner profile.
    const categories = await db.select({ id: serviceCategories.id, name: serviceCategories.name }).from(serviceCategories).where(eq(serviceCategories.isActive, true))

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ services: [], categories, hasProfile: false })

    const services = await db
      .select({
        id: providerServices.id,
        categoryId: providerServices.categoryId,
        categoryName: serviceCategories.name,
        categoryIds: providerServices.categoryIds,
        customCategories: providerServices.customCategories,
        name: providerServices.name,
        description: providerServices.description,
        basePrice: providerServices.basePrice,
        basePriceMax: providerServices.basePriceMax,
        priceUnit: providerServices.priceUnit,
        minDurationMinutes: providerServices.minDurationMinutes,
        isActive: providerServices.isActive,
      })
      .from(providerServices)
      .leftJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
      .where(eq(providerServices.providerId, provider.id))

    return NextResponse.json({ services, categories, hasProfile: true })
  } catch (err) {
    console.error("[provider/services GET]", err)
    void logError({ message: "[provider/services GET]", error: err, route: "/api/provider/services", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const parsed = serviceSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const d = parsed.data
    // Validate every chosen built-in category actually exists. The primary also has an FK, but this
    // returns a clean 400 instead of a 500 on a crafted request, and keeps the extra ids honest.
    const validCats = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.isActive, true))
    const validIds = new Set(validCats.map((c) => c.id))
    if (!d.categoryIds.every((id) => validIds.has(id))) {
      return NextResponse.json({ error: "One or more selected categories are invalid" }, { status: 400 })
    }
    // Wage floor only makes sense for an actual hourly rate — a flat per-job or per-sqft price
    // isn't a wage, so it's left alone (see lib/platform/settings.ts getMinHourlyRateCents()).
    if (d.priceUnit === "per_hour" && d.basePrice !== null) {
      const minHourlyRateCents = await getMinHourlyRateCents()
      if (d.basePrice < minHourlyRateCents) {
        return NextResponse.json(
          { error: { fieldErrors: { basePrice: [`Hourly rate must be at least ${(minHourlyRateCents / 100).toFixed(2)} per hour.`] } } },
          { status: 422 },
        )
      }
      if (d.basePriceMax != null && d.basePriceMax < minHourlyRateCents) {
        return NextResponse.json(
          { error: { fieldErrors: { basePriceMax: [`Hourly rate must be at least ${(minHourlyRateCents / 100).toFixed(2)} per hour.`] } } },
          { status: 422 },
        )
      }
    }
    const [service] = await db.insert(providerServices).values({
      providerId: provider.id,
      categoryId: d.categoryIds[0],          // primary — keeps joins/search working
      categoryIds: d.categoryIds,
      customCategories: d.customCategories,
      name: d.name,
      description: d.description ?? null,
      basePrice: d.basePrice,
      // A range only makes sense alongside an actual price and hourly billing — never persist a
      // stray max when there's no base price to pair it with, or the unit isn't per-hour.
      basePriceMax: d.priceUnit === "per_hour" && d.basePrice != null ? (d.basePriceMax ?? null) : null,
      priceUnit: d.priceUnit,
      minDurationMinutes: d.minDurationMinutes,
      ecoProductsUsed: [],
    }).returning({ id: providerServices.id })

    return NextResponse.json({ serviceId: service.id }, { status: 201 })
  } catch (err) {
    console.error("[provider/services POST]", err)
    void logError({ message: "[provider/services POST]", error: err, route: "/api/provider/services", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const { serviceId } = await req.json().catch(() => ({}))
    if (!serviceId) return NextResponse.json({ error: "serviceId required" }, { status: 400 })

    // Ownership check — prevents a provider from deactivating a competitor's service
    const [service] = await db
      .select({ id: providerServices.id })
      .from(providerServices)
      .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, provider.id)))

    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

    await db.update(providerServices).set({ isActive: false }).where(eq(providerServices.id, serviceId))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[provider/services DELETE]", err)
    void logError({ message: "[provider/services DELETE]", error: err, route: "/api/provider/services", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
