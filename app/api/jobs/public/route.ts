import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { jobPosts, providers } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { getClientIp } from "@/lib/utils/ip"
import { logError } from "@/lib/utils/logError"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const currentIp = getClientIp(req)

    // Upwork model: EVERYONE sees every job. Own/same-IP jobs are FLAGGED (`own`) so the UI hides the
    // bid button on them; the bid API remains the authoritative block.
    const jobs = await db.query.jobPosts.findMany({
      where: (jp, { inArray: inArr, and }) =>
        and(
          // Accepted (assigned) jobs leave the board INSTANTLY — only jobs still open to bids show.
          // Job posts don't auto-expire (expiresAt is set ~100 years out at creation — see
          // /api/jobs POST) — this mirrors the real expiry check used by the provider feed
          // (/api/jobs?forProvider=true) instead of an unrelated 7-day-since-posted cutoff, which
          // was silently hiding perfectly valid older-but-still-open jobs from this board.
          inArr(jp.status, ["open", "bidding"]),
          sql`${jp.expiresAt} > NOW()`,
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
  } catch (err) {
    // Was previously a silent catch — a real DB error rendered identically to "genuinely no open
    // jobs," making the two indistinguishable from the UI. Log it so failures are diagnosable.
    console.error("[jobs/public GET]", err)
    void logError({ message: "[jobs/public GET]", error: err, route: "/api/jobs/public", severity: "error" })
    return NextResponse.json({ jobs: [], canBid: false })
  }
}
