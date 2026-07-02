import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, serviceCategories } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

// Light summary for the booking wizard's pre-selected-cleaner flow (Book button on browse/profile):
// name for the "Booking with X" banner, country for currency/address defaults, and the category slugs
// this cleaner actually offers so the service picker can disable the rest.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const [p] = await db
      .select({ id: providers.id, businessName: providers.businessName, country: providers.country, city: providers.city })
      .from(providers)
      .where(and(eq(providers.id, id), eq(providers.isApproved, true), eq(providers.isSuspended, false)))
    if (!p) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const services = await db
      .select({ categoryId: providerServices.categoryId, categoryIds: providerServices.categoryIds })
      .from(providerServices)
      .where(and(eq(providerServices.providerId, id), eq(providerServices.isActive, true)))

    // Collect primary + extra category ids, then resolve to slugs.
    const catIds = new Set<string>()
    for (const s of services) {
      if (s.categoryId) catIds.add(s.categoryId)
      if (Array.isArray(s.categoryIds)) for (const c of s.categoryIds) catIds.add(c)
    }
    let categorySlugs: string[] = []
    if (catIds.size > 0) {
      const cats = await db.select({ id: serviceCategories.id, slug: serviceCategories.slug }).from(serviceCategories)
      categorySlugs = cats.filter((c) => catIds.has(c.id)).map((c) => c.slug)
    }

    return NextResponse.json({ id: p.id, businessName: p.businessName, country: p.country, city: p.city, categorySlugs })
  } catch (err) {
    console.error("[providers/[id]/summary GET]", err)
    void logError({ message: "[providers/[id]/summary GET]", error: err, route: "/api/providers/[id]/summary", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
