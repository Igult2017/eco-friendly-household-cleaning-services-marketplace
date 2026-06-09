import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts, providers, users } from "@/lib/db/schema"
import type { NewJobPost } from "@/lib/db/schema/jobs"
import { inngest } from "@/lib/inngest/client"
import { jobRatelimit } from "@/lib/redis/client"
import { eq, desc, and } from "drizzle-orm"
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
    line1: z.string().min(2).max(200),
    city: z.string().min(2).max(100),
    postalCode: z.string().min(3).max(10),
    country: z.string().length(2).default("DE"),
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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await jobRatelimit.limit(userId)
  if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  // Only customers may post jobs
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (user?.role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  const insertData: NewJobPost = {
    customerId: userId,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId ?? null,
    budgetMin: data.budgetMin ?? null,
    budgetMax: data.budgetMax ?? null,
    desiredDate: data.desiredDate ?? null,
    desiredTimeRange: data.desiredTimeRange ?? null,
    serviceAddress: data.serviceAddress,
    serviceLatitude: data.serviceLatitude,
    serviceLongitude: data.serviceLongitude,
    radiusKm: data.radiusKm,
    ecoRequirements: data.ecoRequirements,
    expiresAt,
    status: "open",
  }

  const [newJob] = await db.insert(jobPosts).values(insertData).returning({ id: jobPosts.id })

  await inngest.send({ name: "job/posted", data: { jobPostId: newJob.id, customerId: userId } })

  return NextResponse.json({ jobPostId: newJob.id }, { status: 201 })
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const forProvider = searchParams.get("forProvider") === "true"

  if (forProvider) {
    const [provider] = await db
      .select({ id: providers.id, latitude: providers.latitude, longitude: providers.longitude, serviceRadiusKm: providers.serviceRadiusKm })
      .from(providers)
      .where(and(eq(providers.userId, userId), eq(providers.isApproved, true)))

    if (!provider?.latitude || !provider?.longitude) return NextResponse.json({ jobs: [] })

    const allJobs = await db.query.jobPosts.findMany({
      where: (jp: any, { inArray: inArrayFn }: any) => inArrayFn(jp.status, ["open", "bidding"]),
      with: { category: { columns: { name: true, slug: true } }, bids: { columns: { id: true, status: true, providerId: true } } },
      orderBy: [desc(jobPosts.createdAt)],
      limit: 200,
    })

    const providerLat = provider.latitude
    const providerLng = provider.longitude
    const providerRadius = provider.serviceRadiusKm ?? 25

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    const jobs = allJobs.filter((job: any) => {
      if (!job.serviceLatitude || !job.serviceLongitude) return false
      const dist = haversineKm(providerLat, providerLng, job.serviceLatitude, job.serviceLongitude)
      return dist <= providerRadius || dist <= (job.radiusKm ?? 25)
    }).slice(0, 30)

    return NextResponse.json({ jobs })
  }

  const jobs = await db.query.jobPosts.findMany({
    where: (jp: any, { eq: eqFn }: any) => eqFn(jp.customerId, userId),
    with: {
      category: { columns: { name: true } },
      bids: { with: { provider: { columns: { businessName: true, averageRating: true, profilePhotoUrl: true, ecoLevel: true } } } },
    },
    orderBy: [desc(jobPosts.createdAt)],
    limit: 20,
  })

  return NextResponse.json({ jobs })
}
