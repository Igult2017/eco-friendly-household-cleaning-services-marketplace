import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, serviceCategories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const serviceSchema = z.object({
  // At least one built-in category (so clients can find this service); the first is the primary.
  categoryIds: z.array(z.string().uuid()).min(1).max(8),
  // Optional free-text labels not in the built-in list (shown on the profile, not searchable).
  customCategories: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  basePrice: z.number().int().min(100),
  priceUnit: z.enum(["per_job", "per_hour", "per_sqft"]),
  minDurationMinutes: z.number().int().min(30).max(480),
})

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
    // De-dupe custom labels that exactly match a chosen built-in category name would require the
    // names here; we keep them as-is (display-only) and rely on categoryIds for search.
    const [service] = await db.insert(providerServices).values({
      providerId: provider.id,
      categoryId: d.categoryIds[0],          // primary — keeps joins/search working
      categoryIds: d.categoryIds,
      customCategories: d.customCategories,
      name: d.name,
      description: d.description ?? null,
      basePrice: d.basePrice,
      priceUnit: d.priceUnit,
      minDurationMinutes: d.minDurationMinutes,
      ecoProductsUsed: [],
    }).returning({ id: providerServices.id })

    return NextResponse.json({ serviceId: service.id }, { status: 201 })
  } catch (err) {
    console.error("[provider/services POST]", err)
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
