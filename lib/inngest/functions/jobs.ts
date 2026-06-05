import { inngest } from "../client"
import { db } from "@/lib/db"
import { jobPosts, bids, providers, users, notifications } from "@/lib/db/schema"
import { resend, FROM } from "@/lib/resend/client"
import { pusherServer } from "@/lib/pusher/server"
import { findProvidersNearLocation } from "@/lib/db/queries/geo"
import { eq, and } from "drizzle-orm"

export const onJobPosted = inngest.createFunction(
  { id: "job-posted", retries: 2, triggers: [{ event: "job/posted" }] },
  async ({ event, step }: { event: { data: { jobPostId: string; customerId: string } }; step: any }) => {
    const { jobPostId } = event.data

    const job = await step.run("fetch-job", async () => {
      const [j] = await db.query.jobPosts.findMany({
        where: (jp: any, { eq: eqFn }: any) => eqFn(jp.id, jobPostId),
        with: { category: { columns: { name: true } } },
        limit: 1,
      })
      return j ?? null
    })

    if (!job) return { skipped: true }

    // Find approved providers whose service area overlaps the job location
    const nearbyProviders = await step.run("find-nearby-providers", async () => {
      return findProvidersNearLocation({
        latitude: job.serviceLatitude,
        longitude: job.serviceLongitude,
        radiusKm: job.radiusKm ?? 25,
        limit: 50,
      })
    })

    if (nearbyProviders.length === 0) return { notified: 0 }

    // Notify each nearby provider via DB notification + Pusher
    await step.run("notify-providers", async () => {
      for (const provider of nearbyProviders as { id: string; userId: string }[]) {
        await db.insert(notifications).values({
          userId: provider.userId,
          type: "new_job_request",
          title: "New Job Near You!",
          body: `A customer posted a ${job.category?.name ?? "cleaning"} job near you. Check it out!`,
          link: `/provider/jobs`,
        })

        try {
          await pusherServer.trigger(`private-provider-${provider.id}`, "new-job", {
            jobPostId,
            title: job.title,
            categoryName: job.category?.name,
          })
        } catch {
          // Pusher failures are non-critical
        }
      }
    })

    // Schedule expiry in 72 hours
    await step.sleep("wait-72h", "72 hours")

    // INN-005: update DB in one step, send event in a separate step so both are checkpointed
    const shouldExpire = await step.run("expire-job", async () => {
      const [current] = await db.select({ status: jobPosts.status }).from(jobPosts).where(eq(jobPosts.id, jobPostId))
      if (!current || !["open", "bidding"].includes(current.status)) return false
      await db.update(jobPosts).set({ status: "expired" }).where(eq(jobPosts.id, jobPostId))
      return true
    })

    if (shouldExpire) {
      await step.run("send-expired-event", async () => {
        await inngest.send({ name: "job/expired", data: { jobPostId, customerId: job.customerId } })
      })
    }

    return { notified: nearbyProviders.length }
  }
)

export const onJobExpired = inngest.createFunction(
  { id: "job-expired", retries: 2, triggers: [{ event: "job/expired" }] },
  async ({ event, step }: { event: { data: { jobPostId: string; customerId: string } }; step: any }) => {
    const { jobPostId, customerId } = event.data

    // Reject all pending bids and collect bidder userIds for notification
    const rejectedProviderUserIds = await step.run("reject-pending-bids", async () => {
      const pendingBids = await db
        .select({ providerId: bids.providerId })
        .from(bids)
        .where(and(eq(bids.jobPostId, jobPostId), eq(bids.status, "pending")))

      await db
        .update(bids)
        .set({ status: "rejected" })
        .where(and(eq(bids.jobPostId, jobPostId), eq(bids.status, "pending")))

      if (pendingBids.length === 0) return []

      const providerRows = await db
        .select({ userId: providers.userId })
        .from(providers)
        .where(eq(providers.id, pendingBids[0].providerId))

      return providerRows.map((p) => p.userId)
    })

    // Notify customer that their job expired with no accepted bid
    await step.run("notify-customer", async () => {
      await db.insert(notifications).values({
        userId: customerId,
        type: "booking_cancelled",
        title: "Your job post has expired",
        body: "Your job post didn't receive an accepted bid within 72 hours. You can post it again anytime.",
        link: "/post-job",
      })
    })

    // Notify each rejected bidder
    if (rejectedProviderUserIds.length > 0) {
      await step.run("notify-bidders", async () => {
        for (const userId of rejectedProviderUserIds) {
          await db.insert(notifications).values({
            userId,
            type: "booking_cancelled",
            title: "Job post expired",
            body: "A job you bid on has expired without a decision. Keep an eye out for new jobs!",
            link: "/provider/jobs",
          })
        }
      })
    }

    return { jobPostId, expired: true, biddersNotified: rejectedProviderUserIds.length }
  }
)
