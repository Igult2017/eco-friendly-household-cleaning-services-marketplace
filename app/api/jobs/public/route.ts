import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { jobPosts, providers } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { getClientIp } from "@/lib/utils/ip"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const currentIp = getClientIp(req)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Upwork model: EVERYONE sees every job. Own/same-IP jobs are FLAGGED (`own`) so the UI hides the
    // bid button on them; the bid API remains the authoritative block.
    const jobs = await db.query.jobPosts.findMany({
      where: (jp, { inArray: inArr, and, gte }) =>
        and(
          inArr(jp.status, ["open", "bidding", "assigned", "expired"]),
          gte(jp.createdAt, cutoff),
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
      estimatedDurationMinutes: j.estimatedDurationMinutes,
      city: j.serviceAddress?.city ?? null,
      country: j.serviceAddress?.country ?? "DE",
      ecoRequirements: j.ecoRequirements,
      bidCount: j.bids.length,
      categoryName: j.category?.name ?? null,
      categorySlug: j.category?.slug ?? null,
      expiresAt: j.expiresAt,
      createdAt: j.createdAt,
      // The viewer posted this (same account or same IP) — bid button hidden client-side.
      own: (!!userId && j.customerId === userId) || (!!currentIp && !!j.postedIp && j.postedIp === currentIp),
    }))

    // "Can bid" = has a provider profile AND is currently in CLEANER mode. A dual-role user or admin
    // who switched to their CLIENT account (cookie dorix_active_role=customer) is acting as a client,
    // so the bid button is hidden for them too — even though their provider profile still exists.
    let canBid = false
    if (userId) {
      const activeRole = (await cookies()).get("dorix_active_role")?.value
      if (activeRole !== "customer") {
        const [prov] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
        canBid = !!prov
      }
    }

    return NextResponse.json({ jobs: safe, canBid })
  } catch {
    return NextResponse.json({ jobs: [], canBid: false })
  }
}
