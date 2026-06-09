import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications, serviceCategories } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; bidId: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: jobPostId, bidId } = await params

  const [job] = await db
    .select({
      id: jobPosts.id,
      customerId: jobPosts.customerId,
      status: jobPosts.status,
      categoryId: jobPosts.categoryId,
      serviceAddress: jobPosts.serviceAddress,
      serviceLatitude: jobPosts.serviceLatitude,
      serviceLongitude: jobPosts.serviceLongitude,
      desiredDate: jobPosts.desiredDate,
    })
    .from(jobPosts)
    .where(and(eq(jobPosts.id, jobPostId), eq(jobPosts.customerId, userId)))

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  if (!["open", "bidding"].includes(job.status)) return NextResponse.json({ error: "Job is not accepting bid acceptance" }, { status: 422 })

  const [bid] = await db
    .select({
      id: bids.id,
      providerId: bids.providerId,
      amount: bids.amount,
      status: bids.status,
      proposedDate: bids.proposedDate,
      proposedTimeStart: bids.proposedTimeStart,
      estimatedDurationMinutes: bids.estimatedDurationMinutes,
    })
    .from(bids)
    .where(and(eq(bids.id, bidId), eq(bids.jobPostId, jobPostId), eq(bids.status, "pending")))

  if (!bid) return NextResponse.json({ error: "Bid not found or not pending" }, { status: 404 })

  // TOCTOU: row-lock the job row inside a transaction before mutating state
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ status: jobPosts.status })
      .from(jobPosts)
      .where(eq(jobPosts.id, jobPostId))
      .for("update")

    if (!locked || !["open", "bidding"].includes(locked.status)) {
      tx.rollback()
      return
    }

    await tx.update(bids).set({ status: "accepted" }).where(eq(bids.id, bidId))
    await tx
      .update(bids)
      .set({ status: "rejected" })
      .where(and(eq(bids.jobPostId, jobPostId), ne(bids.id, bidId), eq(bids.status, "pending")))
    await tx.update(jobPosts).set({ status: "assigned", acceptedBidId: bidId }).where(eq(jobPosts.id, jobPostId))
  })

  // Look up category slug for bid-flow store hydration
  let categorySlug: string | null = null
  let categoryName: string | null = null
  if (job.categoryId) {
    const [cat] = await db
      .select({ slug: serviceCategories.slug, name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.id, job.categoryId))
    categorySlug = cat?.slug ?? null
    categoryName = cat?.name ?? null
  }

  // Bug 10: link to provider bookings list, not the customer job post
  const [provider] = await db
    .select({ userId: providers.userId })
    .from(providers)
    .where(eq(providers.id, bid.providerId))
  if (provider) {
    await db.insert(notifications).values({
      userId: provider.userId,
      type: "bid_accepted",
      title: "Your bid was accepted!",
      body: `A customer accepted your bid of €${(bid.amount / 100).toFixed(2)}. A booking is being prepared.`,
      link: "/provider/bookings",
    })
  }

  // Build ISO scheduledAt from bid's proposed date/time for the bid-flow booking wizard
  const dateStr = bid.proposedDate ?? job.desiredDate
  const timeStr = bid.proposedTimeStart ? bid.proposedTimeStart.substring(0, 5) : "10:00"
  const scheduledAt = dateStr ? `${dateStr}T${timeStr}:00Z` : null

  return NextResponse.json({
    success: true,
    redirectTo: "/book/confirm",
    // bidFlow: all data needed to pre-populate the booking store without going through the wizard
    bidFlow: {
      providerId: bid.providerId,
      categorySlug,
      categoryName,
      serviceAddress: job.serviceAddress,
      serviceLatitude: job.serviceLatitude,
      serviceLongitude: job.serviceLongitude,
      scheduledAt,
      durationMinutes: bid.estimatedDurationMinutes ?? 120,
      bidAmountCents: bid.amount,
    },
  })
}
