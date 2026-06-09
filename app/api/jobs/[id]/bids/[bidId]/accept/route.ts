import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; bidId: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: jobPostId, bidId } = await params

  const [job] = await db
    .select({ id: jobPosts.id, customerId: jobPosts.customerId, status: jobPosts.status })
    .from(jobPosts)
    .where(and(eq(jobPosts.id, jobPostId), eq(jobPosts.customerId, userId)))

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  if (!["open", "bidding"].includes(job.status)) return NextResponse.json({ error: "Job is not accepting bid acceptance" }, { status: 422 })

  const [bid] = await db
    .select({ id: bids.id, providerId: bids.providerId, amount: bids.amount, status: bids.status })
    .from(bids)
    .where(and(eq(bids.id, bidId), eq(bids.jobPostId, jobPostId), eq(bids.status, "pending")))

  if (!bid) return NextResponse.json({ error: "Bid not found or not pending" }, { status: 404 })

  // Wrap the three state mutations in a transaction with a row lock on the job
  // to prevent TOCTOU: two concurrent accept calls that both pass the status check above.
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
    await tx.update(bids).set({ status: "rejected" })
      .where(and(eq(bids.jobPostId, jobPostId), ne(bids.id, bidId), eq(bids.status, "pending")))
    await tx.update(jobPosts).set({ status: "assigned", acceptedBidId: bidId }).where(eq(jobPosts.id, jobPostId))
  })

  // Notify winning provider (outside transaction — non-critical)
  const [provider] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, bid.providerId))
  if (provider) {
    await db.insert(notifications).values({
      userId: provider.userId,
      type: "bid_accepted",
      title: "Your bid was accepted!",
      body: `A customer accepted your bid of €${(bid.amount / 100).toFixed(2)}. Proceed to book.`,
      link: `/jobs/${jobPostId}`,
    })
  }

  return NextResponse.json({
    success: true,
    providerId: bid.providerId,
    amount: bid.amount,
    redirectTo: `/book?from=bid&jobId=${jobPostId}&providerId=${bid.providerId}&amount=${bid.amount}`,
  })
}
