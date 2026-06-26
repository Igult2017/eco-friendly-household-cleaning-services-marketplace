import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const jobs = await db.query.jobPosts.findMany({
      where: (jp, { inArray: inArr, and, gte: gteFn }) =>
        and(
          inArr(jp.status, ["open", "bidding", "assigned", "expired"]),
          gteFn(jp.createdAt, cutoff),
        ),
      with: {
        category: { columns: { name: true, slug: true } },
        bids: { columns: { id: true } },
      },
      orderBy: [desc(jobPosts.createdAt)],
      limit: 50,
    })

    const safe = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      // Public (unauthenticated) board: only a short teaser — the full free-text description (which
      // can contain access notes / personal details) is shown to authenticated providers, not the world.
      description: j.description ? j.description.slice(0, 100) + (j.description.length > 100 ? "…" : "") : null,
      status: j.status,
      budgetMin: j.budgetMin,
      budgetMax: j.budgetMax,
      desiredDate: j.desiredDate,
      city: j.serviceAddress?.city ?? null,
      country: j.serviceAddress?.country ?? "DE",
      ecoRequirements: j.ecoRequirements,
      bidCount: j.bids.length,
      categoryName: j.category?.name ?? null,
      categorySlug: j.category?.slug ?? null,
      expiresAt: j.expiresAt,
      createdAt: j.createdAt,
    }))

    return NextResponse.json({ jobs: safe })
  } catch {
    return NextResponse.json({ jobs: [] })
  }
}
