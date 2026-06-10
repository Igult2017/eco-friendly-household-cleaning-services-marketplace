import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, serviceCategories } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const categorySlug = searchParams.get("categorySlug")

    const [provider] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(and(eq(providers.id, id), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const conditions = [eq(providerServices.providerId, id), eq(providerServices.isActive, true)]

    const services = await db
      .select({
        id: providerServices.id,
        name: providerServices.name,
        basePrice: providerServices.basePrice,
        priceUnit: providerServices.priceUnit,
        minDurationMinutes: providerServices.minDurationMinutes,
        categorySlug: serviceCategories.slug,
        categoryName: serviceCategories.name,
      })
      .from(providerServices)
      .innerJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
      .where(and(...conditions))

    const filtered = categorySlug ? services.filter((s) => s.categorySlug === categorySlug) : services

    return NextResponse.json({ services: filtered })
  } catch (err) {
    console.error("[providers/[id]/services GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
