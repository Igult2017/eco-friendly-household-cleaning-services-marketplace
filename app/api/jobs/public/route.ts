import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { jobPosts, providers } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { userId } = await auth()
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const jobs = await db.query.jobPosts.findMany({
      where: (jp, { inArray: inArr, and, gte: gteFn, ne }) => {
        const base = and(
          inArr(jp.status, ["open", "bidding", "assigned", "expired"]),
          gteFn(jp.createdAt, cutoff),
        )
        // Never show a signed-in user their OWN posted jobs — they can't bid on them (and it's the same
        // user id across a dual cleaner/client account), so no bid button can ever appear on own work.
        return userId ? and(base, ne(jp.customerId, userId)) : base
      },
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

    // Only a cleaner (a user with a provider profile) can bid — clients never get a bid button.
    let canBid = false
    if (userId) {
      const [prov] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
      canBid = !!prov
    }

    return NextResponse.json({ jobs: safe, canBid })
  } catch {
    return NextResponse.json({ jobs: [], canBid: false })
  }
}
