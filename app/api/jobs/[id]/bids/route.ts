import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, providerServices, notifications, users } from "@/lib/db/schema"
import { sql } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { newBidEmail } from "@/lib/resend/transactionalEmails"
import type { NewBid } from "@/lib/db/schema/bids"
import { pusherServer } from "@/lib/pusher/server"
import { bidRatelimit } from "@/lib/redis/client"
import { eq, and } from "drizzle-orm"
import { getClientIp } from "@/lib/utils/ip"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { getMinHourlyRateCents } from "@/lib/platform/settings"
import { z } from "zod"
import { logError } from "@/lib/utils/logError"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bidSchema = z.object({
  // The cleaner's RATE PER HOUR, in cents — NOT the price of the whole job.
  //
  // This used to be the whole-job total while the box beside it asked for a duration, so a cleaner
  // typing 26 next to "120 minutes" was quoting €26 for two hours' work, not €26 an hour. It
  // underpaid a real cleaner by half (booking BK-2026-000014: 2 hours, €26). The blank-box
  // auto-fill right below always multiplied by the hours correctly — only the typed value didn't.
  //
  // Still stored as a whole-job TOTAL in bids.amount (rate × hours, computed below), because that
  // is what every downstream consumer expects — see lib/bookings/create.ts.
  hourlyRateCents: z.number().int().min(100).optional(),
  message: z.string().max(1000).optional(),
  estimatedDurationMinutes: z.number().int().min(30).max(480).optional(),
  proposedDate: z.string().optional(),
  proposedTimeStart: z.string().optional(),
  acceptedCancellationPolicy: z.literal(true, "You must accept the cancellation policy to bid"),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const { success } = await bidRatelimit.limit(userId)
      if (!success) return NextResponse.json({ error: "Rate limit exceeded. You can submit up to 10 bids per 5 minutes." }, { status: 429 })
    } catch (redisErr) {
      console.warn("[bids POST] Redis rate limit unavailable, allowing through:", redisErr)
    }

    const { id: jobPostId } = await params

    if (!UUID_RE.test(jobPostId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const parsed = bidSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [provider] = await db
      .select({ id: providers.id, businessName: providers.businessName, userId: providers.userId, isApproved: providers.isApproved, latitude: providers.latitude, longitude: providers.longitude, country: providers.country })
      .from(providers)
      .where(and(eq(providers.userId, userId), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

    if (!provider) return NextResponse.json({ error: "Not an approved provider" }, { status: 403 })

    const [job] = await db
      .select({ id: jobPosts.id, title: jobPosts.title, status: jobPosts.status, customerId: jobPosts.customerId, categoryId: jobPosts.categoryId, expiresAt: jobPosts.expiresAt, postedIp: jobPosts.postedIp, serviceLatitude: jobPosts.serviceLatitude, serviceLongitude: jobPosts.serviceLongitude, radiusKm: jobPosts.radiusKm, serviceAddress: jobPosts.serviceAddress, budgetMin: jobPosts.budgetMin })
      .from(jobPosts)
      .where(eq(jobPosts.id, jobPostId))

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (job.customerId === userId) return NextResponse.json({ error: "Cannot bid on your own job" }, { status: 403 })
    // Self-bid prevention: also block a second account bidding from the same IP the job was posted from.
    const bidderIp = getClientIp(req)
    if (bidderIp && job.postedIp && job.postedIp === bidderIp) {
      return NextResponse.json({ error: "Cannot bid on your own job" }, { status: 403 })
    }
    // Jobs are VISIBLE to everyone (Upwork model), but bidding requires being within the client's
    // requested radius — tell the cleaner where the client is instead of a silent block.
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
        const city = (job.serviceAddress as { city?: string } | null)?.city ?? "another area"
        return NextResponse.json(
          { error: `This client is in ${city} and needs a cleaner within ${job.radiusKm ?? 25} km of their location — outside your service area.` },
          { status: 422 },
        )
      }
    }
    if (!["open", "bidding"].includes(job.status)) return NextResponse.json({ error: "Job is not accepting bids" }, { status: 422 })
    if (new Date(job.expiresAt) < new Date()) {
      console.warn("[bids POST] rejected as expired", { jobPostId, expiresAt: job.expiresAt, now: new Date().toISOString() })
      return NextResponse.json({ error: "Job has expired" }, { status: 422 })
    }

    const [existing] = await db
      .select({ id: bids.id })
      .from(bids)
      .where(and(eq(bids.providerId, provider.id), eq(bids.jobPostId, jobPostId)))

    if (existing) return NextResponse.json({ error: "You have already submitted a bid for this job" }, { status: 409 })

    const data = parsed.data
    const durationMinutes = data.estimatedDurationMinutes ?? 120

    // The typed figure is a RATE PER HOUR, so multiply it by the booked hours exactly as the
    // auto-fill below already does. Before this, a typed number was banked as the whole-job price
    // while the auto-filled one was multiplied — same box, two different meanings.
    const typedRateCents = data.hourlyRateCents
    // Now that the figure is unambiguously a rate per hour, the wage floor can be checked against
    // it — which was impossible while the box held a whole-job total, because a "low" total might
    // just have been a short job. Same live, admin-set floor the job-posting form already applies.
    if (typedRateCents !== undefined) {
      const minRate = await getMinHourlyRateCents()
      if (typedRateCents < minRate) {
        return NextResponse.json(
          { error: { fieldErrors: { hourlyRateCents: [`Your hourly rate must be at least ${(minRate / 100).toFixed(2)} per hour.`] } } },
          { status: 422 },
        )
      }
    }
    const typedTotal = typedRateCents !== undefined
      ? Math.round((typedRateCents * durationMinutes) / 60)
      : undefined

    // Every box on the bid form is optional, including the price — fill it in from the cleaner's
    // own listed rate for this job's category instead of forcing them to type one every time.
    let autoAmount: number | undefined
    if (typedRateCents === undefined) {
      const myServices = await db
        .select({ basePrice: providerServices.basePrice, priceUnit: providerServices.priceUnit, categoryIds: providerServices.categoryIds })
        .from(providerServices)
        .where(and(eq(providerServices.providerId, provider.id), eq(providerServices.isActive, true)))
      const priced = myServices.filter((s) => s.basePrice != null)
      const categoryMatch = job.categoryId
        ? priced.find((s) => Array.isArray(s.categoryIds) && (s.categoryIds as string[]).includes(job.categoryId as string))
        : undefined
      const best = categoryMatch ?? priced[0]
      if (best?.basePrice != null) {
        autoAmount = best.priceUnit === "per_hour" ? Math.round((best.basePrice * durationMinutes) / 60) : best.basePrice
      }
    }
    // Still nothing (no rate entered, no priced service to fill it in from)? Fall back to the
    // client's own posted minimum for this job — a bid is always submittable, and the client still
    // reviews and can decline/negotiate before it becomes a real booking, unlike a Take Job claim.
    const amount = typedTotal ?? autoAmount ?? job.budgetMin ?? undefined
    if (amount === undefined) {
      return NextResponse.json(
        { error: { fieldErrors: { hourlyRateCents: ["Couldn't work out a price for this bid — please enter your hourly rate."] } } },
        { status: 422 },
      )
    }

    const insertData: NewBid = {
      jobPostId,
      providerId: provider.id,
      amount,
      message: data.message ?? null,
      // Stored resolved (not left null when omitted) so the record matches whatever duration the
      // price was actually calculated against.
      estimatedDurationMinutes: durationMinutes,
      proposedDate: data.proposedDate ?? null,
      proposedTimeStart: data.proposedTimeStart ?? null,
      status: "pending",
      cancellationPolicyAcceptedAt: new Date(),
    }

    const [newBid] = await db.insert(bids).values(insertData).returning({ id: bids.id })

    if (job.status === "open") {
      await db.update(jobPosts).set({ status: "bidding" }).where(eq(jobPosts.id, jobPostId))
    }

    // Bid amounts are in the CLEANER's currency (EUR/USD by their country) — never hardcode €.
    const amountLabel = formatCurrencyForCountry(amount, provider.country || "DE")
    await db.insert(notifications).values({
      userId: job.customerId,
      type: "bid_received",
      title: `New bid from ${provider.businessName}`,
      body: `${amountLabel} — ${data.message?.slice(0, 80) ?? "No message"}`,
      link: `/jobs/${jobPostId}`,
      metadata: {
        name: provider.businessName,
        amount: amountLabel,
        message: data.message?.slice(0, 80) ?? "No message",
      },
    })

    try {
      await pusherServer.trigger(`private-customer-${job.customerId}`, "new-bid", {
        bidId: newBid.id,
        jobPostId,
        providerName: provider.businessName,
        amount,
      })
    } catch {}

    // Email the client for the FIRST THREE bids on a job (respecting their email-reminders setting).
    // Acceptance closes bidding entirely, so if the first bid is accepted only one email ever goes out.
    try {
      const [cnt] = await db.select({ n: sql<number>`count(*)` }).from(bids).where(eq(bids.jobPostId, jobPostId))
      if (Number(cnt?.n ?? 0) <= 3) {
        const [cu] = await db.select({ email: users.email, locale: users.locale, emailReminders: users.emailReminders }).from(users).where(eq(users.id, job.customerId))
        if (cu?.email && cu.emailReminders !== false) {
          const { subject, html } = newBidEmail(cu.locale, { name: provider.businessName, amount: amountLabel, title: job.title })
          await resend.emails.send({ from: FROM, to: cu.email, subject, html })
        }
      }
    } catch (emailErr) {
      console.warn("[bids POST] new-bid email failed (bid still created):", emailErr)
    }

    return NextResponse.json({ bidId: newBid.id }, { status: 201 })
  } catch (err) {
    console.error("[jobs/[id]/bids POST]", err)
    void logError({ message: "[jobs/[id]/bids POST]", error: err, route: "/api/jobs/[id]/bids", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: jobPostId } = await params

    const [job] = await db
      .select({ customerId: jobPosts.customerId })
      .from(jobPosts)
      .where(eq(jobPosts.id, jobPostId))

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (job.customerId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const jobBids = await db.query.bids.findMany({
      where: (b: any, { eq: eqFn }: any) => eqFn(b.jobPostId, jobPostId),
      with: {
        provider: {
          columns: {
            businessName: true,
            bio: true,
            averageRating: true,
            totalReviews: true,
            totalJobsCompleted: true,
            profilePhotoUrl: true,
            ecoLevel: true,
            ecoScore: true,
            city: true,
            postalCode: true,
            country: true,
          },
        },
      },
      orderBy: (b: any, { asc }: any) => [asc(b.createdAt)],
    })

    return NextResponse.json({ bids: jobBids })
  } catch (err) {
    console.error("[jobs/[id]/bids GET]", err)
    void logError({ message: "[jobs/[id]/bids GET]", error: err, route: "/api/jobs/[id]/bids", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
