import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bids, jobPosts, providers, notifications } from "@/lib/db/schema"
import type { NewBid } from "@/lib/db/schema/bids"
import { pusherServer } from "@/lib/pusher/server"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const bidSchema = z.object({
  amount: z.number().int().min(100),
  message: z.string().max(1000).optional(),
  estimatedDurationMinutes: z.number().int().min(30).max(480).optional(),
  proposedDate: z.string().optional(),
  proposedTimeStart: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: jobPostId } = await params

  const [provider] = await db
    .select({ id: providers.id, businessName: providers.businessName, isApproved: providers.isApproved })
    .from(providers)
    .where(and(eq(providers.userId, userId), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

  if (!provider) return NextResponse.json({ error: "Not an approved provider" }, { status: 403 })

  const [job] = await db
    .select({ id: jobPosts.id, status: jobPosts.status, customerId: jobPosts.customerId, expiresAt: jobPosts.expiresAt })
    .from(jobPosts)
    .where(eq(jobPosts.id, jobPostId))

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  if (!["open", "bidding"].includes(job.status)) return NextResponse.json({ error: "Job is not accepting bids" }, { status: 422 })
  if (new Date(job.expiresAt) < new Date()) return NextResponse.json({ error: "Job has expired" }, { status: 422 })

  // Check for existing bid
  const [existing] = await db
    .select({ id: bids.id })
    .from(bids)
    .where(and(eq(bids.providerId, provider.id), eq(bids.jobPostId, jobPostId)))

  if (existing) return NextResponse.json({ error: "You have already submitted a bid for this job" }, { status: 409 })

  const body = await req.json()
  const parsed = bidSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

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

  // Update job to "bidding"
  if (job.status === "open") {
    await db.update(jobPosts).set({ status: "bidding" }).where(eq(jobPosts.id, jobPostId))
  }

  // Notify customer
  await db.insert(notifications).values({
    userId: job.customerId,
    type: "bid_received",
    title: `New bid from ${provider.businessName}`,
    body: `€${(data.amount / 100).toFixed(2)} — ${data.message?.slice(0, 80) ?? "No message"}`,
    link: `/jobs/${jobPostId}`,
  })

  try {
    await pusherServer.trigger(`private-customer-${job.customerId}`, "new-bid", {
      bidId: newBid.id,
      jobPostId,
      providerName: provider.businessName,
      amount: data.amount,
    })
  } catch {
    // non-critical
  }

  return NextResponse.json({ bidId: newBid.id }, { status: 201 })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: jobPostId } = await params

  // Verify the caller owns this job post
  const [job] = await db
    .select({ customerId: jobPosts.customerId })
    .from(jobPosts)
    .where(eq(jobPosts.id, jobPostId))

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  if (job.customerId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const jobBids = await db.query.bids.findMany({
    where: (b: any, { eq: eqFn }: any) => eqFn(b.jobPostId, jobPostId),
    with: {
      provider: { columns: { businessName: true, averageRating: true, totalReviews: true, profilePhotoUrl: true, ecoLevel: true, city: true } },
    },
    orderBy: (b: any, { asc }: any) => [asc(b.createdAt)],
  })

  return NextResponse.json({ bids: jobBids })
}
