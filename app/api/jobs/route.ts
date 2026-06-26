import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts, providers, users } from "@/lib/db/schema"
import type { NewJobPost } from "@/lib/db/schema/jobs"
import { inngest } from "@/lib/inngest/client"
import { jobRatelimit } from "@/lib/redis/client"
import { eq, desc, and, inArray, sql } from "drizzle-orm"
import { z } from "zod"

const createJobSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  categoryId: z.string().uuid().optional(),
  budgetMin: z.number().int().min(100).optional(),
  budgetMax: z.number().int().min(100).optional(),
  desiredDate: z.string().optional(),
  desiredTimeRange: z.object({ start: z.string(), end: z.string() }).optional(),
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
}).refine(
  (d) => !d.budgetMin || !d.budgetMax || d.budgetMax >= d.budgetMin,
  { message: "budgetMax must be >= budgetMin", path: ["budgetMax"] },
)

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
    if (role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const parsed = createJobSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data
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
      desiredDate: data.desiredDate ?? null,
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
      expiresAt,
      status: "open",
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
        .select({ id: providers.id, latitude: providers.latitude, longitude: providers.longitude, serviceRadiusKm: providers.serviceRadiusKm, isApproved: providers.isApproved })
        .from(providers)
        .where(eq(providers.userId, userId))

      if (!provider || !provider.isApproved || provider.latitude == null || provider.longitude == null) {
        console.warn("[jobs feed] empty (provider gate):", { userId, hasProvider: !!provider, isApproved: provider?.isApproved ?? null, hasLat: provider?.latitude != null, hasLng: provider?.longitude != null })
        return NextResponse.json({ jobs: [] })
      }

      // Bug 8: use PostGIS ST_DWithin to push the geo filter into SQL — eliminates the 200-row in-memory cap
      const providerLat = provider.latitude
      const providerLng = provider.longitude
      const radiusMeters = (provider.serviceRadiusKm ?? 25) * 1000

      // Step 1: get nearby job IDs. PostGIS path (fast, indexed) with a pure-SQL Haversine
      // bounding-box fallback for servers where PostGIS isn't installed — WITHOUT this the entire
      // provider job feed 500s and cleaners see no jobs to bid on. Mirrors lib/db/queries/geo.ts.
      // Fraud prevention (both paths): users cannot bid on jobs they posted as customers.
      let nearbyRows: { id: string }[]
      try {
        nearbyRows = await db
          .select({ id: jobPosts.id })
          .from(jobPosts)
          .where(and(
            inArray(jobPosts.status, ["open", "bidding"]),
            sql`expires_at > NOW()`,
            sql`customer_id != ${userId}`,
            sql`service_location IS NOT NULL AND ST_DWithin(service_location::geography, ST_MakePoint(${providerLng}, ${providerLat})::geography, ${radiusMeters})`,
          ))
          .orderBy(sql`ST_Distance(service_location::geography, ST_MakePoint(${providerLng}, ${providerLat})::geography)`)
          .limit(30)
      } catch {
        // PostGIS not available — fall back to a lat/lng bounding box on the plain columns.
        const radiusKmVal = provider.serviceRadiusKm ?? 25
        const latDelta = radiusKmVal / 111.32
        const lngDelta = radiusKmVal / (111.32 * Math.cos((providerLat * Math.PI) / 180))
        nearbyRows = await db
          .select({ id: jobPosts.id })
          .from(jobPosts)
          .where(and(
            inArray(jobPosts.status, ["open", "bidding"]),
            sql`expires_at > NOW()`,
            sql`customer_id != ${userId}`,
            sql`service_latitude BETWEEN ${providerLat - latDelta} AND ${providerLat + latDelta}`,
            sql`service_longitude BETWEEN ${providerLng - lngDelta} AND ${providerLng + lngDelta}`,
          ))
          .orderBy(desc(jobPosts.createdAt))
          .limit(30)
      }

      if (nearbyRows.length === 0) {
        // Diagnostic: distinguish "no open jobs at all" vs "all open jobs are this user's own"
        // vs "open jobs exist but are out of this provider's radius".
        const [diag] = await db
          .select({
            totalOpen: sql<number>`count(*)`,
            ownOpen: sql<number>`count(*) filter (where customer_id = ${userId})`,
          })
          .from(jobPosts)
          .where(and(inArray(jobPosts.status, ["open", "bidding"]), sql`expires_at > NOW()`))
        console.warn("[jobs feed] empty (no nearby):", { userId, providerLat, providerLng, radiusKm: provider.serviceRadiusKm ?? 25, totalOpenJobs: Number(diag?.totalOpen ?? 0), ownOpenJobs: Number(diag?.ownOpen ?? 0) })
        return NextResponse.json({ jobs: [] })
      }

      const nearbyIds = nearbyRows.map((r: { id: string }) => r.id)

      // Step 2: fetch full job data with relations for the nearby IDs
      const rawJobs = await db.query.jobPosts.findMany({
        where: (jp: any, { inArray: inArrayFn }: any) => inArrayFn(jp.id, nearbyIds),
        // H3: project only board-safe fields. customerId, exact serviceLatitude/Longitude,
        // categoryId and acceptedBidId are deliberately NOT selected.
        columns: {
          id: true, title: true, description: true, status: true,
          budgetMin: true, budgetMax: true, desiredDate: true, desiredTimeRange: true,
          radiusKm: true, ecoRequirements: true, viewCount: true, expiresAt: true, createdAt: true,
          serviceAddress: true, // reduced to coarse locality below
        },
        with: { category: { columns: { name: true, slug: true } }, bids: { columns: { id: true, status: true, providerId: true } } },
      })
      // H3: strip the street line + keep only city/postal/country until a bid is accepted, so
      // providers can't scrape exact home addresses + GPS of every nearby customer (GDPR).
      const jobs = rawJobs.map((j: any) => ({
        ...j,
        serviceAddress: j.serviceAddress
          ? { city: j.serviceAddress.city ?? null, postalCode: j.serviceAddress.postalCode ?? null, country: j.serviceAddress.country ?? null }
          : null,
      }))

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
          orderBy: (b: any, { desc: d }: any) => [d(b.amount)],
        },
      },
      orderBy: [desc(jobPosts.createdAt)],
      limit: 20,
    })

    return NextResponse.json({ jobs })
  } catch (err) {
    console.error("[jobs GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
