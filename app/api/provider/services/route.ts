import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, serviceCategories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const serviceSchema = z.object({
  categoryId: z.string().uuid(),
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

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const services = await db
      .select({
        id: providerServices.id,
        categoryId: providerServices.categoryId,
        categoryName: serviceCategories.name,
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

    const categories = await db.select({ id: serviceCategories.id, name: serviceCategories.name }).from(serviceCategories).where(eq(serviceCategories.isActive, true))

    return NextResponse.json({ services, categories })
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

    const body = await req.json()
    const parsed = serviceSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [service] = await db.insert(providerServices).values({
      providerId: provider.id,
      ...parsed.data,
      description: parsed.data.description ?? null,
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

    const { serviceId } = await req.json()
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
