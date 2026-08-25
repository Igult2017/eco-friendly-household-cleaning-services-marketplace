import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { jobPosts, providers, users, bids } from "@/lib/db/schema"
import { computeReliability } from "@/lib/provider/reliability"
import type { NewJobPost } from "@/lib/db/schema/jobs"
import { inngest } from "@/lib/inngest/client"
import { jobRatelimit } from "@/lib/redis/client"
import { eq, desc, and, inArray, sql } from "drizzle-orm"
import { getClientIp } from "@/lib/utils/ip"
import { formatDistance } from "@/lib/utils/locale"
import { z } from "zod"
import { logError } from "@/lib/utils/logError"
import { ensureUserRow } from "@/lib/clerk/ensureUser"
import { stripe } from "@/lib/stripe/client"
import { getMinHourlyRateCents } from "@/lib/platform/settings"

const createJobSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  categoryId: z.string().uuid().optional(),
  // Required: the per-hour amount (×hours = these totals) is mandatory when posting.
  budgetMin: z.number().int().min(100),
  budgetMax: z.number().int().min(100),
  // Whole currency units per hour — sent explicitly (not just derived from budgetMin÷hours) so the
  // minimum-wage floor (checked in the handler, live from platform_settings) can be enforced directly
  // against the actual rate rather than reverse-derived from a possibly-rounded total.
  hourlyRate: z.number().min(1).max(1000),
  desiredDate: z.string().optional(),
  desiredTimeRange: z
    .object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
    .refine((r) => r.end > r.start, { message: "end must be after start" })
    .optional(),
  serviceAddress: z.object({
    line1: z.string().max(200).optional(),
    city: z.string().min(2).max(100),
    postalCode: z.string().min(3).max(10),
    country: z.string().length(2),
  }),
  serviceLatitude: z.number().min(-90).max(90),
  serviceLongitude: z.number().min(-180).max(180),
  radiusKm: z.number().int().min(1).max(100).default(25),
  ecoRequirements: z.array(z.string().max(100)).max(10).default([]),
  recurringFrequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  // Weekday(s) picked alongside recurringFrequency (0=Sun..6=Sat) — ignored unless a frequency is
  // also set. Monthly is meant to be a single day; the form enforces that, this just stores it.
  recurringDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  estimatedHours: z.number().min(0.5).max(12).optional(),
  // "standard" = normal bidding. "take_job" = emergency instant-assignment (see /api/jobs/[id]/take) —
  // no negotiation, so the client's single price IS the price. This one instance is always same-day,
  // but the client can still say they want it on a regular schedule going forward (recurringFrequency).
  jobType: z.enum(["standard", "take_job"]).default("standard"),
}).refine(
  (d) => !d.budgetMin || !d.budgetMax || d.budgetMax >= d.budgetMin,
  { message: "budgetMax must be >= budgetMin", path: ["budgetMax"] },
)
// Take Job's min/max is a real range now, same as a standard post — the claiming cleaner's own
// rate decides the actual price within it (or the range midpoint, if they have none on file); see
// the resolution logic in app/api/jobs/[id]/take/route.ts.
// Take Job itself is always a same-day, single instance — but the client can still SAY they want
// this kind of cleaning on a regular schedule going forward, same as a standard post. The actual
// schedule only gets set up later, once a specific cleaner is known (see the post-completion
// recurring nudge in lib/inngest/functions/completion.ts) — recurringFrequency here is only ever a
// stated intent, identically for both job types, so there's no technical reason to block it.

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const { success } = await jobRatelimit.limit(userId)
      if (!success) return NextResponse.json({ error: "Rate limit exceeded. You can post up to 5 jobs per 10 minutes." }, { status: 429 })
    } catch (redisErr) {
      console.warn("[jobs POST] Redis rate limit unavailable, allowing through:", redisErr)
    }

    // Role check: JWT claims are authoritative (set by Clerk during onboarding).
    // Fall back to DB only when JWT has not refreshed yet (60 s TTL).
    const jwtRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role
    let role = jwtRole
    if (!role) {
      const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
      role = dbUser?.role ?? "customer"
    }
    // Admins can post jobs to test the customer experience — mirrors middleware.ts's "admin bypasses
    // all role-gated routes" behavior and switch-role's "admin can always switch." A dual-role
    // provider/affiliate who switched into customer mode (dorix_active_role cookie) can also post —
    // verified live against Clerk rather than trusting the (non-httpOnly, client-settable) cookie
    // alone, since this is a write with real side effects, unlike the read-only canBid check in
    // /api/jobs/public that trusts the cookie directly.
    let allowed = role === "admin" || role === "customer"
    if (!allowed && (await cookies()).get("dorix_active_role")?.value === "customer") {
      try {
        const clerk = await clerkClient()
        const clerkUser = await clerk.users.getUser(userId)
        allowed = (clerkUser.publicMetadata as { dualRole?: boolean })?.dualRole === true
      } catch { /* Clerk unavailable — fall through to Forbidden, fail-closed */ }
    }
    if (!allowed) return NextResponse.json({ error: "Only clients can post jobs. If you also have a client account, switch to it first." }, { status: 403 })
    if (!(await ensureUserRow(userId))) return NextResponse.json({ error: "Could not link your account. Please reload and try again." }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const parsed = createJobSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data

    const minHourlyRateCents = await getMinHourlyRateCents()
    if (Math.round(data.hourlyRate * 100) < minHourlyRateCents) {
      return NextResponse.json(
        { error: { fieldErrors: { hourlyRate: [`Hourly rate must be at least ${(minHourlyRateCents / 100).toFixed(2)} per hour.`] } } },
        { status: 422 },
      )
    }

    // Job posts do NOT auto-expire — they stay on the board until the customer accepts a cleaner
    // (status → assigned) or cancels. expires_at is NOT NULL and is read by the bid/feed paths, so
    // we set it ~100 years out, i.e. effectively "never".
    const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)

    const insertData: NewJobPost = {
      customerId: userId,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId ?? null,
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      desiredDate: data.desiredDate || null, // "" from an untouched date picker must not hit the date column
      desiredTimeRange: data.desiredTimeRange ?? null,
      serviceAddress: {
        line1: data.serviceAddress.line1 ?? "",
        city: data.serviceAddress.city,
        postalCode: data.serviceAddress.postalCode,
        country: data.serviceAddress.country,
      },
      serviceLatitude: data.serviceLatitude,
      serviceLongitude: data.serviceLongitude,
      radiusKm: data.radiusKm,
      ecoRequirements: data.ecoRequirements,
      recurringFrequency: data.recurringFrequency ?? null,
      recurringDays: data.recurringFrequency ? (data.recurringDays ?? []) : [],
      estimatedDurationMinutes: data.estimatedHours ? Math.round(data.estimatedHours * 60) : null,
      jobType: data.jobType,
      expiresAt,
      status: "open",
      postedIp: getClientIp(req),
    }

    const [newJob] = await db.insert(jobPosts).values(insertData).returning({ id: jobPosts.id })
    if (!newJob?.id) throw new Error("DB insert returned no ID")

    // Inngest is non-critical — job is already created; don't let a missing/invalid
    // INNGEST_EVENT_KEY kill the response.
    try {
      await inngest.send({ name: "job/posted", data: { jobPostId: newJob.id, customerId: userId } })
    } catch (inngestErr) {
      console.warn("[jobs POST] Inngest send failed (job still created):", inngestErr instanceof Error ? inngestErr.message : inngestErr)
    }

    return NextResponse.json({ jobPostId: newJob.id }, { status: 201 })
  } catch (err) {
    // Surface the underlying Postgres cause (Drizzle wraps it as err.cause) so
    // schema-drift failures (missing column, broken trigger) are diagnosable.
    const cause = (err as { cause?: { message?: string; code?: string; detail?: string; column?: string; constraint?: string; table?: string } })?.cause
    console.error("[jobs POST] Unhandled error:", {
      message: err instanceof Error ? err.message : String(err),
      cause: cause ? { message: cause.message, code: cause.code, detail: cause.detail, column: cause.column, constraint: cause.constraint, table: cause.table } : undefined,
      stack: err instanceof Error ? err.stack : undefined,
    })
    void logError({ message: "[jobs POST]", error: err, route: "/api/jobs", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const forProvider = searchParams.get("forProvider") === "true"

    if (forProvider) {
      const [provider] = await db
        .select({ id: providers.id, latitude: providers.latitude, longitude: providers.longitude, country: providers.country, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
        .from(providers)
        .where(eq(providers.userId, userId))

      // Mirror the bid API's gate (approved AND not suspended) — otherwise a suspended cleaner sees a
      // fully biddable board where every submission 403s with a contradictory message.
      if (!provider || !provider.isApproved || provider.isSuspended) {
        console.warn("[jobs feed] empty (not active):", { userId, hasProvider: !!provider, isApproved: provider?.isApproved ?? null, isSuspended: provider?.isSuspended ?? null })
        return NextResponse.json({ jobs: [], reason: "not_active" })
      }

      // Upwork model: EVERY cleaner sees ALL open jobs. Ownership/same-IP and distance no longer HIDE
      // jobs — they gate the BID action instead (per-job flags below; the bid API stays authoritative).
      const currentIp = getClientIp(req)
      const geoRows = await db
        .select({
          id: jobPosts.id,
          lat: jobPosts.serviceLatitude,
          lng: jobPosts.serviceLongitude,
          radiusKm: jobPosts.radiusKm,
          customerId: jobPosts.customerId,
          postedIp: jobPosts.postedIp,
        })
        .from(jobPosts)
        .where(and(inArray(jobPosts.status, ["open", "bidding"]), sql`expires_at > NOW()`))
        .orderBy(desc(jobPosts.createdAt))
        .limit(50)

      // Jobs this cleaner WON (bid accepted, status assigned) stay on their board so the client chat
      // is reachable — assigned jobs are otherwise filtered out.
      const wonRows = await db
        .select({ id: jobPosts.id })
        .from(jobPosts)
        .innerJoin(bids, eq(jobPosts.acceptedBidId, bids.id))
        .where(and(eq(jobPosts.status, "assigned"), eq(bids.providerId, provider.id)))
        .orderBy(desc(jobPosts.createdAt))
        .limit(10)
      const wonIds = new Set(wonRows.map((r) => r.id))

      if (geoRows.length === 0 && wonRows.length === 0) return NextResponse.json({ jobs: [], reason: "none_posted" })

      // Distance is computed SERVER-side (exact job coords are never sent to the browser — H3).
      const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
        const R = 6371
        const dLat = ((bLat - aLat) * Math.PI) / 180
        const dLng = ((bLng - aLng) * Math.PI) / 180
        const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
        return 2 * R * Math.asin(Math.sqrt(h))
      }
      const meta = new Map(
        geoRows.map((r) => {
          const own = r.customerId === userId || (!!currentIp && !!r.postedIp && r.postedIp === currentIp)
          const km = provider.latitude != null && provider.longitude != null ? haversineKm(provider.latitude, provider.longitude, r.lat, r.lng) : null
          return [r.id, {
            own,
            withinRadius: km != null && km <= (r.radiusKm ?? 25),
            distanceLabel: km != null ? formatDistance(km, provider.country || "DE") : null,
          }]
        }),
      )

      // Whether each job's client has a real, usable payment method — surfaced to cleaners as a
      // "no payment method yet" badge so they can factor payment risk into bidding or taking a job.
      // Only computed for open/bidding jobs (geoRows); an already-won/assigned job isn't a bidding
      // decision anymore, so it's left out of this and defaults to no badge below.
      const distinctCustomerIds = [...new Set(geoRows.map((r) => r.customerId))]
      const customerUsers = distinctCustomerIds.length
        ? await db.select({ id: users.id, stripeCustomerId: users.stripeCustomerId }).from(users).where(inArray(users.id, distinctCustomerIds))
        : []
      const hasPaymentMethodByUser = new Map<string, boolean>()
      await Promise.all(
        customerUsers.map(async (u) => {
          if (!u.stripeCustomerId) { hasPaymentMethodByUser.set(u.id, false); return }
          try {
            const pms = await stripe.paymentMethods.list({ customer: u.stripeCustomerId, type: "card", limit: 1 })
            hasPaymentMethodByUser.set(u.id, pms.data.length > 0)
          } catch {
            hasPaymentMethodByUser.set(u.id, false)
          }
        }),
      )
      const hasPaymentMethodByJob = new Map(geoRows.map((r) => [r.id, hasPaymentMethodByUser.get(r.customerId) ?? false]))

      const nearbyIds = [...new Set([...geoRows.map((r) => r.id), ...wonIds])]

      // Which of these jobs this cleaner already bid on — the UI's session-local "submitted" state
      // is lost on reload, letting them re-open the form only to hit the API's 409.
      const myBids = await db
        .select({ jobPostId: bids.jobPostId })
        .from(bids)
        .where(and(eq(bids.providerId, provider.id), inArray(bids.jobPostId, nearbyIds)))
      const myBidJobIds = new Set(myBids.map((b) => b.jobPostId))

      // Step 2: fetch full job data with relations for the nearby IDs
      const rawJobs = await db.query.jobPosts.findMany({
        where: (jp: any, { inArray: inArrayFn }: any) => inArrayFn(jp.id, nearbyIds),
        // H3: project only board-safe fields. customerId, exact serviceLatitude/Longitude,
        // categoryId and acceptedBidId are deliberately NOT selected.
        columns: {
          id: true, title: true, description: true, status: true, jobType: true,
          budgetMin: true, budgetMax: true, desiredDate: true, desiredTimeRange: true,
          radiusKm: true, ecoRequirements: true, recurringFrequency: true, recurringDays: true, estimatedDurationMinutes: true, viewCount: true, expiresAt: true, createdAt: true,
          serviceAddress: true, // reduced to coarse locality below
        },
        with: { category: { columns: { name: true, slug: true } }, bids: { columns: { id: true, status: true, providerId: true } } },
      })
      // H3: strip the street line + keep only city/postal/country until a bid is accepted, so
      // providers can't scrape exact home addresses + GPS of every nearby customer (GDPR).
      const jobs = rawJobs
        .map((j: any) => ({
          ...j,
          serviceAddress: j.serviceAddress
            ? { city: j.serviceAddress.city ?? null, postalCode: j.serviceAddress.postalCode ?? null, country: j.serviceAddress.country ?? null }
            : null,
          ...(meta.get(j.id) ?? { own: false, withinRadius: false, distanceLabel: null }),
          alreadyBid: myBidJobIds.has(j.id),
          wonByMe: wonIds.has(j.id),
          hasPaymentMethod: hasPaymentMethodByJob.get(j.id) ?? true,
        }))
        // Won jobs first (client chat lives there), then biddable-nearby, then the rest; own last.
        .sort((a: any, b: any) => {
          const rank = (x: any) => (x.wonByMe ? -1 : x.own ? 2 : x.withinRadius ? 0 : 1)
          if (rank(a) !== rank(b)) return rank(a) - rank(b)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

      // Increment view count — each provider load counts as an impression
      try {
        await db.update(jobPosts)
          .set({ viewCount: sql`view_count + 1` })
          .where(inArray(jobPosts.id, nearbyIds))
      } catch (viewErr) {
        console.warn("[jobs GET provider] viewCount increment failed:", viewErr)
      }

      return NextResponse.json({ jobs })
    }

    const jobs = await db.query.jobPosts.findMany({
      where: (jp: any, { eq: eqFn }: any) => eqFn(jp.customerId, userId),
      with: {
        category: { columns: { name: true } },
        bids: {
          with: {
            provider: {
              columns: {
                slug: true,
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
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: (b: any, { desc: d }: any) => [d(b.amount)],
        },
      },
      orderBy: [desc(jobPosts.createdAt)],
      limit: 20,
    })

    // Review privilege: bids are ranked by the cleaner's reliability (rating 60% + completion 40%,
    // same engine as /provider/statistics) — best-reviewed cleaners surface FIRST, and the top
    // bidder with a real track record is flagged as the best match for the client.
    const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const R = 6371
      const dLat = ((bLat - aLat) * Math.PI) / 180
      const dLng = ((bLng - aLng) * Math.PI) / 180
      const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
      return 2 * R * Math.asin(Math.sqrt(h))
    }
    const ranked = jobs.map((j: any) => {
      const scored = [...j.bids].map((b: any) => ({
        b,
        r: computeReliability({
          completed: b.provider?.totalJobsCompleted ?? 0,
          cancelledByProvider: 0,
          averageRating: b.provider?.averageRating ?? null,
          totalReviews: b.provider?.totalReviews ?? 0,
        }),
      }))
      scored.sort((x, y) => y.r.score - x.r.score || (y.b.provider?.totalJobsCompleted ?? 0) - (x.b.provider?.totalJobsCompleted ?? 0))
      return {
        ...j,
        bids: scored.map(({ b, r }, i) => {
          // Distance cleaner↔job computed server-side; raw coords are never sent to the browser (H3).
          const p = b.provider
          const distanceLabel =
            p?.latitude != null && p?.longitude != null && j.serviceLatitude != null && j.serviceLongitude != null
              ? formatDistance(km(p.latitude, p.longitude, j.serviceLatitude, j.serviceLongitude), j.serviceAddress?.country ?? p.country ?? "DE")
              : null
          const provider = p ? { ...p, latitude: undefined, longitude: undefined } : null
          return {
            ...b,
            provider,
            distanceLabel,
            reliabilityScore: r.score,
            reliabilityTier: r.tier,
            bestMatch: i === 0 && r.tier !== "new",
          }
        }),
      }
    })

    return NextResponse.json({ jobs: ranked })
  } catch (err) {
    console.error("[jobs GET]", err)
    void logError({ message: "[jobs GET]", error: err, route: "/api/jobs", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
