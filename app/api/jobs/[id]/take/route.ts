import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications, serviceCategories } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { getClientIp } from "@/lib/utils/ip"
import { pusherServer } from "@/lib/pusher/server"
import { logError } from "@/lib/utils/logError"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Take Job" instant-assignment claim — completely independent of the normal bid/accept workflow.
// The FIRST eligible provider to hit this endpoint wins; no client approval step exists (matches the
// requirement). Modeled directly on app/api/jobs/[id]/bids/[bidId]/accept/route.ts's race-safe
// transaction, and returns the same bidFlow shape so the existing /book/confirm payment pipeline is
// reused verbatim.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: jobPostId } = await params
    if (!UUID_RE.test(jobPostId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })

    const [provider] = await db
      .select({
        id: providers.id, userId: providers.userId, businessName: providers.businessName,
        isApproved: providers.isApproved, isSuspended: providers.isSuspended,
        instantJobsAvailable: providers.instantJobsAvailable,
        latitude: providers.latitude, longitude: providers.longitude, country: providers.country,
      })
      .from(providers)
      .where(eq(providers.userId, userId))

    if (!provider || !provider.isApproved || provider.isSuspended) {
      return NextResponse.json({ error: "Not an approved provider" }, { status: 403 })
    }
    if (!provider.instantJobsAvailable) {
      return NextResponse.json({ error: 'Turn on "Available for instant jobs" to claim emergency jobs.' }, { status: 403 })
    }

    const [job] = await db
      .select({
        id: jobPosts.id, title: jobPosts.title, status: jobPosts.status, jobType: jobPosts.jobType,
        customerId: jobPosts.customerId, categoryId: jobPosts.categoryId, postedIp: jobPosts.postedIp,
        serviceAddress: jobPosts.serviceAddress,
        serviceLatitude: jobPosts.serviceLatitude, serviceLongitude: jobPosts.serviceLongitude,
        radiusKm: jobPosts.radiusKm, budgetMin: jobPosts.budgetMin,
        estimatedDurationMinutes: jobPosts.estimatedDurationMinutes,
      })
      .from(jobPosts)
      .where(eq(jobPosts.id, jobPostId))

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (job.jobType !== "take_job") return NextResponse.json({ error: "This job isn't an instant-claim job" }, { status: 422 })
    if (job.customerId === userId) return NextResponse.json({ error: "Cannot take your own job" }, { status: 403 })
    const claimerIp = getClientIp(req)
    if (claimerIp && job.postedIp && job.postedIp === claimerIp) {
      return NextResponse.json({ error: "Cannot take your own job" }, { status: 403 })
    }
    if (job.status !== "open") return NextResponse.json({ error: "This job has already been claimed by another cleaner." }, { status: 409 })
    if (!job.budgetMin) return NextResponse.json({ error: "This job has no price set" }, { status: 422 })

    // Distance gate — identical haversine formula to normal bid submission (bids/route.ts).
    {
      const R = 6371
      const toRad = (d: number) => (d * Math.PI) / 180
      const km = provider.latitude != null && provider.longitude != null
        ? 2 * R * Math.asin(Math.sqrt(
            Math.sin(toRad(job.serviceLatitude - provider.latitude) / 2) ** 2 +
            Math.cos(toRad(provider.latitude)) * Math.cos(toRad(job.serviceLatitude)) *
            Math.sin(toRad(job.serviceLongitude - provider.longitude) / 2) ** 2,
          ))
        : null
      if (km == null || km > (job.radiusKm ?? 25)) {
        return NextResponse.json({ error: "You're outside this job's claim radius." }, { status: 422 })
      }
    }

    // Atomic claim: SELECT...FOR UPDATE + status re-check inside a transaction. BUG-011 lesson (from
    // the bid-accept route) applies here too — never call tx.rollback() on a lost race, it throws and
    // the outer catch turns it into a 500. Return early instead; that just commits a harmless no-op.
    let lostRace = false
    let newBidId: string | null = null
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ status: jobPosts.status })
        .from(jobPosts)
        .where(eq(jobPosts.id, jobPostId))
        .for("update")

      if (!locked || locked.status !== "open") {
        lostRace = true
        return
      }

      // A real (if synthetic) bids row — status "accepted" immediately, no "pending" phase — is what
      // lets the entire existing payment/booking pipeline (bidFlow, /book/confirm, createBooking's
      // bid-consumption UPDATE) work completely unchanged for a Take Job claim.
      const [inserted] = await tx
        .insert(bids)
        .values({
          jobPostId,
          providerId: provider.id,
          amount: job.budgetMin!,
          status: "accepted",
          estimatedDurationMinutes: job.estimatedDurationMinutes,
          cancellationPolicyAcceptedAt: new Date(),
        })
        .returning({ id: bids.id })
      newBidId = inserted.id

      await tx.update(jobPosts).set({ status: "assigned", acceptedBidId: inserted.id }).where(eq(jobPosts.id, jobPostId))
    })

    if (lostRace || !newBidId) {
      return NextResponse.json({ error: "This job has already been claimed by another cleaner." }, { status: 409 })
    }

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

    const amountLabel = formatCurrencyForCountry(job.budgetMin, provider.country || "DE")

    // The claim itself IS the "acceptance" — this notification is the only signal the client gets,
    // there's no approval step for them to take.
    try {
      await db.insert(notifications).values({
        userId: job.customerId,
        type: "job_taken",
        title: "Your emergency job was claimed!",
        body: `${provider.businessName} claimed "${job.title}" for ${amountLabel}. Complete payment to confirm.`,
        // /jobs/[id] has no real per-job detail page (it just redirects to /jobs) — link straight
        // to the list, where the "payment outstanding" banner now surfaces this job unmissably.
        link: `/jobs`,
        metadata: { name: provider.businessName, amount: amountLabel, title: job.title },
      })
      await pusherServer
        .trigger(`private-customer-${job.customerId}`, "job-taken", { jobPostId, providerName: provider.businessName, amount: job.budgetMin })
        .catch(() => undefined)
    } catch (e) {
      console.warn("[jobs take] client notification failed:", e)
    }

    // Board-wide, non-private broadcast: any cleaner currently looking at the job board removes
    // this card instantly instead of finding out only when they try to claim it and get a 409.
    await pusherServer.trigger("job-board", "job-claimed", { jobPostId }).catch(() => undefined)

    try {
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "bid_accepted",
        title: "You claimed this job!",
        body: `Complete payment is being prepared for "${job.title}" (${amountLabel}).`,
        link: "/provider/jobs",
        metadata: { amount: amountLabel },
      })
    } catch (e) {
      console.warn("[jobs take] provider notification failed:", e)
    }

    // ASAP, no proposed date to interpret — 2h is the same minimum-future floor the rest of the
    // payment/booking pipeline already assumes is safe (mirrors the accept route's fallback path).
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    return NextResponse.json({
      success: true,
      redirectTo: "/book/confirm",
      bidFlow: {
        providerId: provider.id,
        categorySlug,
        categoryName,
        serviceAddress: job.serviceAddress,
        serviceLatitude: job.serviceLatitude,
        serviceLongitude: job.serviceLongitude,
        scheduledAt,
        durationMinutes: job.estimatedDurationMinutes ?? 120,
        bidAmountCents: job.budgetMin,
        providerCountry: provider.country ?? null,
        requestedFrequency: null, // Take Job is never recurring
      },
    })
  } catch (err) {
    console.error("[jobs/[id]/take POST]", err)
    void logError({ message: "[jobs/[id]/take POST]", error: err, route: "/api/jobs/[id]/take", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
