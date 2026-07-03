import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications, serviceCategories, users } from "@/lib/db/schema"
import { resend, FROM } from "@/lib/resend/client"
import { bidAcceptedEmail } from "@/lib/resend/transactionalEmails"
import { eq, and, ne } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { zonedTimeToUtc } from "@/lib/utils/tz"
import { logError } from "@/lib/utils/logError"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; bidId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: jobPostId, bidId } = await params

    const [job] = await db
      .select({
        id: jobPosts.id,
        title: jobPosts.title,
        customerId: jobPosts.customerId,
        status: jobPosts.status,
        categoryId: jobPosts.categoryId,
        serviceAddress: jobPosts.serviceAddress,
        serviceLatitude: jobPosts.serviceLatitude,
        serviceLongitude: jobPosts.serviceLongitude,
        desiredDate: jobPosts.desiredDate,
        recurringFrequency: jobPosts.recurringFrequency,
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

    // Re-validate the bidder is still an active cleaner — they may have been suspended/unapproved
    // since bidding. Accepting otherwise locks the job to "assigned", rejects every other bid, and
    // dead-ends (payment-intent creation refuses a suspended/unapproved provider).
    const [bidder] = await db
      .select({ isApproved: providers.isApproved, isSuspended: providers.isSuspended })
      .from(providers)
      .where(eq(providers.id, bid.providerId))
    if (!bidder || !bidder.isApproved || bidder.isSuspended) {
      return NextResponse.json({ error: "This cleaner is no longer available. Please choose another bid." }, { status: 422 })
    }

    // Losing bidders (captured BEFORE the transaction flips them to rejected) — notified below so
    // they know to keep bidding elsewhere.
    const losers = await db
      .select({ providerUserId: providers.userId })
      .from(bids)
      .innerJoin(providers, eq(bids.providerId, providers.id))
      .where(and(eq(bids.jobPostId, jobPostId), eq(bids.status, "pending"), ne(bids.id, bidId)))

    // TOCTOU: row-lock the job row inside a transaction before mutating state.
    // BUG-011: don't call tx.rollback() for the race-loser — it throws and the outer
    // catch turns it into a 500. Flag it and return a 409 below. Returning early from
    // the callback (before any write) just commits a harmless no-op transaction.
    let lostRace = false
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ status: jobPosts.status })
        .from(jobPosts)
        .where(eq(jobPosts.id, jobPostId))
        .for("update")

      if (!locked || !["open", "bidding"].includes(locked.status)) {
        lostRace = true
        return
      }

      await tx.update(bids).set({ status: "accepted" }).where(eq(bids.id, bidId))
      await tx
        .update(bids)
        .set({ status: "rejected" })
        .where(and(eq(bids.jobPostId, jobPostId), ne(bids.id, bidId), eq(bids.status, "pending")))
      await tx.update(jobPosts).set({ status: "assigned", acceptedBidId: bidId }).where(eq(jobPosts.id, jobPostId))
    })

    if (lostRace) {
      return NextResponse.json({ error: "This job is no longer accepting bids" }, { status: 409 })
    }

    // Tell every losing bidder the job went to someone else — and to keep bidding on other offers.
    if (losers.length > 0) {
      try {
        await db.insert(notifications).values(
          losers.map((l) => ({
            userId: l.providerUserId,
            type: "bid_received" as const,
            title: "Job assigned to another cleaner",
            body: `“${job.title}” was assigned to another cleaner. Don't stop — new jobs are posted all the time, keep bidding!`,
            link: "/provider/jobs",
            metadata: { variant: "bid_lost_assigned", title: job.title },
          })),
        )
      } catch (e) { console.warn("[bids accept] loser notifications failed:", e) }
    }

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
      .select({ userId: providers.userId, country: providers.country, timezone: providers.timezone })
      .from(providers)
      .where(eq(providers.id, bid.providerId))
    if (provider) {
      const amountLabel = formatCurrencyForCountry(bid.amount, provider.country || "DE")
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "bid_accepted",
        title: "Your bid was accepted!",
        body: `A customer accepted your bid of ${amountLabel}. A booking is being prepared.`,
        // The booking doesn't exist until the client pays — land on the jobs board, where the won
        // job is pinned on top with the client chat.
        link: "/provider/jobs",
        metadata: { amount: amountLabel },
      })
      // Always email the cleaner — an accepted bid is money-relevant, not a mere reminder.
      try {
        const [pu] = await db.select({ email: users.email, locale: users.locale }).from(users).where(eq(users.id, provider.userId))
        if (pu?.email) {
          const { subject, html } = bidAcceptedEmail(pu.locale, { amount: amountLabel })
          await resend.emails.send({ from: FROM, to: pu.email, subject, html })
        }
      } catch (emailErr) {
        console.warn("[bids accept] email failed (accept still succeeded):", emailErr)
      }
    }

    // Build the booking instant. Two past bugs here:
    // 1. The proposed wall-time was stamped with "Z" (treated as UTC) — shifting the real slot by the
    //    cleaner's UTC offset. Interpret it in the CLEANER's timezone instead.
    // 2. No future check — a bid accepted after its proposed date sailed through payment auth and then
    //    createBooking's future-refine rejected it, stranding the card hold. Clamp to the fallback.
    const tz = provider?.timezone || "Europe/Berlin"
    const dateStr = bid.proposedDate ?? job.desiredDate
    const timeStr = bid.proposedTimeStart ? bid.proposedTimeStart.substring(0, 5) : "10:00"
    const fallback = () => {
      const fd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const ymd = fd.toLocaleDateString("en-CA", { timeZone: tz })
      return zonedTimeToUtc(ymd, "10:00", tz)
    }
    let when: Date
    if (dateStr) {
      try { when = zonedTimeToUtc(dateStr, timeStr, tz) } catch { when = fallback() }
      // At least 2h in the future, else use the fallback date — never hand the client an
      // instant that payment will authorize but booking creation must reject.
      if (when.getTime() < Date.now() + 2 * 60 * 60 * 1000) when = fallback()
    } else {
      when = fallback()
    }
    const scheduledAt = when.toISOString()

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
        providerCountry: provider?.country ?? null,
        // Carry the job's recurring intent into the booking (was silently dropped at this handoff).
        requestedFrequency: job.recurringFrequency ?? null,
      },
    })
  } catch (err) {
    console.error("[jobs/[id]/bids/[bidId]/accept POST]", err)
    void logError({ message: "[jobs/[id]/bids/[bidId]/accept POST]", error: err, route: "/api/jobs/[id]/bids/[bidId]/accept", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
