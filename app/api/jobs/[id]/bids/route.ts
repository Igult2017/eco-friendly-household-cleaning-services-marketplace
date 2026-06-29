import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications } from "@/lib/db/schema"
import type { NewBid } from "@/lib/db/schema/bids"
import { pusherServer } from "@/lib/pusher/server"
import { bidRatelimit } from "@/lib/redis/client"
import { eq, and } from "drizzle-orm"
import { getClientIp } from "@/lib/utils/ip"
import { z } from "zod"
import { logError } from "@/lib/utils/logError"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bidSchema = z.object({
  amount: z.number().int().min(100),
  message: z.string().max(1000).optional(),
  estimatedDurationMinutes: z.number().int().min(30).max(480).optional(),
  proposedDate: z.string().optional(),
  proposedTimeStart: z.string().optional(),
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
      .select({ id: providers.id, businessName: providers.businessName, userId: providers.userId, isApproved: providers.isApproved })
      .from(providers)
      .where(and(eq(providers.userId, userId), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

    if (!provider) return NextResponse.json({ error: "Not an approved provider" }, { status: 403 })

    const [job] = await db
      .select({ id: jobPosts.id, status: jobPosts.status, customerId: jobPosts.customerId, expiresAt: jobPosts.expiresAt, postedIp: jobPosts.postedIp })
      .from(jobPosts)
      .where(eq(jobPosts.id, jobPostId))

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (job.customerId === userId) return NextResponse.json({ error: "Cannot bid on your own job" }, { status: 403 })
    // Self-bid prevention: also block a second account bidding from the same IP the job was posted from.
    const bidderIp = getClientIp(req)
    if (bidderIp && job.postedIp && job.postedIp === bidderIp) {
      return NextResponse.json({ error: "Cannot bid on your own job" }, { status: 403 })
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
    const insertData: NewBid = {
      jobPostId,
      providerId: provider.id,
      amount: data.amount,
      message: data.message ?? null,
      estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
      proposedDate: data.proposedDate ?? null,
      proposedTimeStart: data.proposedTimeStart ?? null,
      status: "pending",
    }

    const [newBid] = await db.insert(bids).values(insertData).returning({ id: bids.id })

    if (job.status === "open") {
      await db.update(jobPosts).set({ status: "bidding" }).where(eq(jobPosts.id, jobPostId))
    }

    await db.insert(notifications).values({
      userId: job.customerId,
      type: "bid_received",
      title: `New bid from ${provider.businessName}`,
      body: `€${(data.amount / 100).toFixed(2)} — ${data.message?.slice(0, 80) ?? "No message"}`,
      link: `/jobs/${jobPostId}`,
      metadata: {
        name: provider.businessName,
        amount: `€${(data.amount / 100).toFixed(2)}`,
        message: data.message?.slice(0, 80) ?? "No message",
      },
    })

    try {
      await pusherServer.trigger(`private-customer-${job.customerId}`, "new-bid", {
        bidId: newBid.id,
        jobPostId,
        providerName: provider.businessName,
        amount: data.amount,
      })
    } catch {}

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
