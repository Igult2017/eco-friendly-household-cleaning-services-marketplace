import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts, bids, providers, serviceCategories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { isUuid } from "@/lib/utils/uuid"
import { zonedTimeToUtc } from "@/lib/utils/tz"
import { logError } from "@/lib/utils/logError"

// RESUME an accepted-bid checkout. Accepting a bid hydrates the booking store client-side and
// redirects to payment — but if the client navigates away, that state is gone and the accepted job
// showed a dead "booking in progress" with no way to pay. This rebuilds the same bidFlow payload so
// "Complete booking" works any time until the booking exists.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id: jobPostId } = await params
    if (!isUuid(jobPostId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const [job] = await db
      .select({
        id: jobPosts.id, customerId: jobPosts.customerId, status: jobPosts.status,
        acceptedBidId: jobPosts.acceptedBidId, categoryId: jobPosts.categoryId,
        serviceAddress: jobPosts.serviceAddress, serviceLatitude: jobPosts.serviceLatitude,
        serviceLongitude: jobPosts.serviceLongitude, desiredDate: jobPosts.desiredDate,
        recurringFrequency: jobPosts.recurringFrequency,
      })
      .from(jobPosts)
      .where(and(eq(jobPosts.id, jobPostId), eq(jobPosts.customerId, userId)))
    if (!job?.acceptedBidId || job.status !== "assigned") {
      return NextResponse.json({ error: "No accepted bid to complete" }, { status: 404 })
    }

    const [bid] = await db
      .select({
        id: bids.id, providerId: bids.providerId, amount: bids.amount, status: bids.status,
        bookingId: bids.bookingId, proposedDate: bids.proposedDate,
        proposedTimeStart: bids.proposedTimeStart, estimatedDurationMinutes: bids.estimatedDurationMinutes,
      })
      .from(bids)
      .where(eq(bids.id, job.acceptedBidId))
    if (!bid || bid.status !== "accepted") return NextResponse.json({ error: "No accepted bid to complete" }, { status: 404 })

    // Already paid → the booking exists; send the client there instead.
    if (bid.bookingId) return NextResponse.json({ booked: true, bookingId: bid.bookingId })

    const [provider] = await db
      .select({ country: providers.country, timezone: providers.timezone })
      .from(providers)
      .where(eq(providers.id, bid.providerId))

    let categorySlug: string | null = null
    let categoryName: string | null = null
    if (job.categoryId) {
      const [cat] = await db.select({ slug: serviceCategories.slug, name: serviceCategories.name }).from(serviceCategories).where(eq(serviceCategories.id, job.categoryId))
      categorySlug = cat?.slug ?? null
      categoryName = cat?.name ?? null
    }

    // Same instant-building rules as the accept route: cleaner's timezone, clamped ≥2h future.
    const tz = provider?.timezone || "Europe/Berlin"
    const dateStr = bid.proposedDate ?? job.desiredDate
    const timeStr = bid.proposedTimeStart ? bid.proposedTimeStart.substring(0, 5) : "10:00"
    const fallback = () => {
      const fd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      return zonedTimeToUtc(fd.toLocaleDateString("en-CA", { timeZone: tz }), "10:00", tz)
    }
    let when: Date
    if (dateStr) {
      try { when = zonedTimeToUtc(dateStr, timeStr, tz) } catch { when = fallback() }
      if (when.getTime() < Date.now() + 2 * 60 * 60 * 1000) when = fallback()
    } else {
      when = fallback()
    }

    return NextResponse.json({
      bidFlow: {
        providerId: bid.providerId,
        categorySlug,
        categoryName,
        serviceAddress: job.serviceAddress,
        serviceLatitude: job.serviceLatitude,
        serviceLongitude: job.serviceLongitude,
        scheduledAt: when.toISOString(),
        durationMinutes: bid.estimatedDurationMinutes ?? 120,
        bidAmountCents: bid.amount,
        providerCountry: provider?.country ?? null,
        requestedFrequency: job.recurringFrequency ?? null,
      },
    })
  } catch (err) {
    console.error("[jobs/[id]/checkout GET]", err)
    void logError({ message: "[jobs/[id]/checkout GET]", error: err, route: "/api/jobs/[id]/checkout", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
