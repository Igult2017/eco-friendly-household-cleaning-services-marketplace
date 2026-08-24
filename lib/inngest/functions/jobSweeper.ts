import { inngest } from "../client"
import { db } from "@/lib/db"
import { jobPosts, bids, notifications, providers } from "@/lib/db/schema"
import { and, eq, lt, isNull } from "drizzle-orm"

// Safety net: a job can reach "assigned" (a bid accepted, or a Take Job claim won) without a real
// booking ever following it — the client abandoned the payment step, or (before this session's fix)
// the winning cleaner's payout account wasn't actually ready. Left alone, the job stays locked
// forever: every other bidder already rejected, nobody able to act on it. This hourly sweep frees
// anything still stuck 24h after assignment.
export const jobAssignmentSweeper = inngest.createFunction(
  { id: "job-assignment-sweeper", retries: 1, triggers: [{ cron: "30 * * * *" }] },
  async ({ step }: { step: any }) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const stuck = await step.run("find-stuck", async () => {
      return db
        .select({
          jobId: jobPosts.id, title: jobPosts.title, customerId: jobPosts.customerId,
          bidId: bids.id, providerId: bids.providerId,
        })
        .from(jobPosts)
        .innerJoin(bids, eq(jobPosts.acceptedBidId, bids.id))
        .where(and(
          eq(jobPosts.status, "assigned"),
          isNull(bids.bookingId),
          lt(jobPosts.assignedAt, cutoff),
        ))
        .limit(100)
    })

    let freed = 0
    for (const job of stuck as { jobId: string; title: string; customerId: string; bidId: string; providerId: string }[]) {
      await step.run(`free-${job.jobId}`, async () => {
        const updated = await db
          .update(jobPosts)
          .set({ status: "cancelled" })
          .where(and(eq(jobPosts.id, job.jobId), eq(jobPosts.status, "assigned")))
          .returning({ id: jobPosts.id })
        if (updated.length === 0) return // already handled by a concurrent run

        await db.update(bids).set({ status: "rejected" }).where(eq(bids.id, job.bidId))

        const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, job.providerId))
        await db.insert(notifications).values([
          {
            userId: job.customerId, type: "booking_cancelled" as const,
            title: "Your job was cancelled — payment was never completed",
            body: `"${job.title}" was assigned to a cleaner but payment was never finished within 24 hours, so it's been cancelled. Post it again if you still need this done.`,
            link: "/jobs",
          },
          ...(prov ? [{
            userId: prov.userId, type: "booking_cancelled" as const,
            title: "A claimed job fell through",
            body: `"${job.title}" was cancelled — the client never completed payment within 24 hours. No action needed on your end.`,
            link: "/provider/jobs",
          }] : []),
        ])
      })
      freed++
    }

    return { freed }
  }
)
