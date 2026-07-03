import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { jobPosts, bids } from "@/lib/db/schema"
import { eq, and, sql, inArray } from "drizzle-orm"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

const editSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(20).max(2000).optional(),
  desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  desiredTimeRange: z
    .object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
    .refine((r) => r.end > r.start)
    .nullable()
    .optional(),
  estimatedHours: z.number().min(0.5).max(12).optional(),
  hourlyRate: z.number().min(1).max(1000).optional(), // whole currency units per hour
  recurringFrequency: z.enum(["recurring", "weekly", "biweekly", "monthly"]).nullable().optional(),
})

// Client deletes their own job — allowed ONLY while it has no bids at all and isn't assigned.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 })

    const [job] = await db
      .select({ id: jobPosts.id, status: jobPosts.status })
      .from(jobPosts)
      .where(and(eq(jobPosts.id, id), eq(jobPosts.customerId, userId)))
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (!["open", "bidding"].includes(job.status)) {
      return NextResponse.json({ error: "This job has been assigned and can no longer be deleted." }, { status: 422 })
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(bids).where(eq(bids.jobPostId, id))
    if (Number(n) > 0) {
      return NextResponse.json({ error: "Cleaners have already bid on this job — it can't be deleted. You can edit the date or accept a bid instead." }, { status: 422 })
    }

    await db.delete(jobPosts).where(and(eq(jobPosts.id, id), eq(jobPosts.customerId, userId)))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[jobs/[id] DELETE]", err)
    void logError({ message: "[jobs/[id] DELETE]", error: err, route: "/api/jobs/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Client edits their own job. Full edit while NO bids have arrived; once bids exist only the desired
// date may be changed (extended) — anything else would pull the rug from under the bidders.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 })

    const parsed = editSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const data = parsed.data

    const [job] = await db
      .select({ id: jobPosts.id, status: jobPosts.status, estimatedDurationMinutes: jobPosts.estimatedDurationMinutes })
      .from(jobPosts)
      .where(and(eq(jobPosts.id, id), eq(jobPosts.customerId, userId)))
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (!["open", "bidding"].includes(job.status)) {
      return NextResponse.json({ error: "This job can no longer be edited." }, { status: 422 })
    }

    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(bids).where(and(eq(bids.jobPostId, id), inArray(bids.status, ["pending", "accepted"])))
    const hasBids = Number(n) > 0
    if (hasBids && (data.title !== undefined || data.description !== undefined || data.hourlyRate !== undefined || data.estimatedHours !== undefined || data.recurringFrequency !== undefined || data.desiredTimeRange !== undefined)) {
      return NextResponse.json({ error: "Bids have already arrived — only the desired date can be changed." }, { status: 422 })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.desiredDate !== undefined) updates.desiredDate = data.desiredDate || null
    if (data.desiredTimeRange !== undefined) updates.desiredTimeRange = data.desiredTimeRange
    if (data.estimatedHours !== undefined) updates.estimatedDurationMinutes = Math.round(data.estimatedHours * 60)
    if (data.recurringFrequency !== undefined) updates.recurringFrequency = data.recurringFrequency
    if (data.hourlyRate !== undefined) {
      const hours = data.estimatedHours ?? (job.estimatedDurationMinutes ? job.estimatedDurationMinutes / 60 : 2)
      const total = Math.round(data.hourlyRate * 100 * hours)
      updates.budgetMin = total
      updates.budgetMax = total
    }

    await db.update(jobPosts).set(updates).where(eq(jobPosts.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[jobs/[id] PATCH]", err)
    void logError({ message: "[jobs/[id] PATCH]", error: err, route: "/api/jobs/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
