import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts } from "@/lib/db/schema"
import { inArray, desc, gte } from "drizzle-orm"

export const revalidate = 60 // ISR: refresh every 60s

export async function GET() {
  // Include assigned + expired so UI can show "Not Available" / "Expired" badges
  // Limit to jobs created in the last 7 days to avoid stale clutter
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

  // Strip full address — only expose city for privacy
  const safe = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    description: j.description,
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
}
