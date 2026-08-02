import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, serviceCategories } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const categorySlug = searchParams.get("categorySlug")

    const [provider] = await db
      .select({ id: providers.id, timezone: providers.timezone })
      .from(providers)
      .where(and(eq(providers.id, id), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    // Resolve the requested category slug → id so we can match a service's FULL category set
    // (primary + extras), not just its primary category.
    let wantedCategoryId: string | null = null
    if (categorySlug) {
      const [cat] = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.slug, categorySlug))
      wantedCategoryId = cat?.id ?? null
    }

    const services = await db
      .select({
        id: providerServices.id,
        name: providerServices.name,
        basePrice: providerServices.basePrice,
        priceUnit: providerServices.priceUnit,
        minDurationMinutes: providerServices.minDurationMinutes,
        maxDurationMinutes: providerServices.maxDurationMinutes,
        categoryId: providerServices.categoryId,
        categoryIds: providerServices.categoryIds,
        categorySlug: serviceCategories.slug,
        categoryName: serviceCategories.name,
      })
      .from(providerServices)
      .leftJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
      .where(and(eq(providerServices.providerId, id), eq(providerServices.isActive, true)))

    const filtered = wantedCategoryId
      ? services.filter((s) => s.categoryId === wantedCategoryId || (Array.isArray(s.categoryIds) && s.categoryIds.includes(wantedCategoryId!)))
      : services

    // The wizard never gates category selection by what a cleaner has explicitly listed — a client
    // can pick any category for any cleaner (a manual note covers the gap). If nothing matches the
    // requested category, fall back to whatever real service this cleaner DOES have, rather than
    // dead-ending pricing. Only a cleaner with literally zero active services still returns empty.
    const result = filtered.length > 0 ? filtered : services

    // Surfaced so the booking wizard can set up a recurring schedule (needs the cleaner's tz to
    // compute the next occurrence) without a second round-trip to the availability endpoint.
    return NextResponse.json({
      services: result,
      providerTimezone: provider.timezone ?? "Europe/Amsterdam",
      categoryMatched: filtered.length > 0,
    })
  } catch (err) {
    console.error("[providers/[id]/services GET]", err)
    void logError({ message: "[providers/[id]/services GET]", error: err, route: "/api/providers/[id]/services", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
