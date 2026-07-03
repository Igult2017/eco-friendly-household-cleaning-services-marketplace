import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts, bids, messages, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Admin removes a job from the board (moderation). Deletes the job with its bids + job chat in one
// transaction, then informs the owner. Assigned jobs' BOOKINGS are untouched — only the post goes.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAdmin()
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 })

    const [job] = await db
      .select({ id: jobPosts.id, title: jobPosts.title, customerId: jobPosts.customerId })
      .from(jobPosts)
      .where(eq(jobPosts.id, id))
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    await db.transaction(async (tx) => {
      await tx.delete(messages).where(eq(messages.jobPostId, id))
      await tx.update(jobPosts).set({ acceptedBidId: null }).where(eq(jobPosts.id, id))
      await tx.delete(bids).where(eq(bids.jobPostId, id))
      await tx.delete(jobPosts).where(eq(jobPosts.id, id))
    })

    try {
      await db.insert(notifications).values({
        userId: job.customerId,
        type: "booking_reminder",
        title: "Your job post was removed",
        body: `Your job post “${job.title}” was removed from the job board by the DORIXÉ team. If you believe this was a mistake, contact support.`,
        link: "/support",
        metadata: { variant: "admin_job_removed", title: job.title },
      })
    } catch (e) { console.warn("[admin/jobs DELETE] owner notification failed:", e) }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/jobs DELETE]", err)
    void logError({ message: "[admin/jobs DELETE]", error: err, route: "/api/admin/jobs/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
