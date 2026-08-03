import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Backing out of an already-claimed/accepted job BEFORE payment — the window that
// app/(customer)/jobs/page.tsx's `needsPayment` check already identifies (assigned, has an
// accepted bid, no booking yet). Once a booking exists this route refuses; that's the existing
// booking-cancellation flow's job (fee tiers etc.), not this one's.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: jobPostId } = await params
    if (!isUuid(jobPostId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })

    const [job] = await db
      .select({
        id: jobPosts.id, title: jobPosts.title, status: jobPosts.status,
        customerId: jobPosts.customerId, acceptedBidId: jobPosts.acceptedBidId,
      })
      .from(jobPosts)
      .where(eq(jobPosts.id, jobPostId))
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (job.status !== "assigned" || !job.acceptedBidId) {
      return NextResponse.json({ error: "This job isn't in a state that can be cancelled." }, { status: 422 })
    }

    const [bid] = await db
      .select({ id: bids.id, providerId: bids.providerId, bookingId: bids.bookingId })
      .from(bids)
      .where(eq(bids.id, job.acceptedBidId))
    if (!bid) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (bid.bookingId) {
      return NextResponse.json({ error: "This job already has a booking — cancel it from your bookings page instead." }, { status: 422 })
    }

    const [provider] = await db
      .select({ userId: providers.userId })
      .from(providers)
      .where(eq(providers.id, bid.providerId))
    if (!provider) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const isCustomer = job.customerId === userId
    const isProvider = provider.userId === userId
    if (!isCustomer && !isProvider) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Client backing out closes the job for good; the cleaner backing out just frees it up for
    // someone else (Take Job: instantly re-claimable; standard: open to fresh bids).
    const newJobStatus = isCustomer ? "cancelled" : "open"
    const newBidStatus = isCustomer ? "rejected" : "withdrawn"

    let lostRace = false
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ status: jobPosts.status })
        .from(jobPosts)
        .where(eq(jobPosts.id, jobPostId))
        .for("update")

      if (!locked || locked.status !== "assigned") {
        lostRace = true
        return
      }

      await tx.update(bids).set({ status: newBidStatus }).where(eq(bids.id, job.acceptedBidId!))
      await tx.update(jobPosts).set({ status: newJobStatus, acceptedBidId: null }).where(eq(jobPosts.id, jobPostId))
    })

    if (lostRace) {
      return NextResponse.json({ error: "This job already moved on — please refresh." }, { status: 409 })
    }

    try {
      await db.insert(notifications).values({
        userId: isCustomer ? provider.userId : job.customerId,
        type: "booking_cancelled",
        title: isCustomer ? "Job cancelled" : "Cleaner released this job",
        body: isCustomer
          ? `The client cancelled "${job.title}" before payment. No charge was made.`
          : `Your cleaner is no longer able to do "${job.title}". It's back on the board for another cleaner to claim.`,
        link: isCustomer ? "/provider/jobs" : "/jobs",
        metadata: { variant: isCustomer ? "job_cancel_by_client" : "job_release_by_provider", title: job.title },
      })
    } catch (e) {
      console.warn("[jobs cancel] notification failed:", e)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[jobs/[id]/cancel POST]", err)
    void logError({ message: "[jobs/[id]/cancel POST]", error: err, route: "/api/jobs/[id]/cancel", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
