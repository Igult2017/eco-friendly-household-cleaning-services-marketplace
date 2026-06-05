import { inngest } from "../client"
import { db } from "@/lib/db"
import { jobPosts, bids, providers, users, notifications } from "@/lib/db/schema"
import { resend, FROM } from "@/lib/resend/client"
import { pusherServer } from "@/lib/pusher/server"
import { findJobsNearProvider } from "@/lib/db/queries/geo"
import { eq, and, inArray } from "drizzle-orm"

export const onJobPosted = inngest.createFunction(
  { id: "job-posted", triggers: [{ event: "job/posted" }] },
  async ({ event, step }: { event: { data: { jobPostId: string; customerId: string } }; step: any }) => {
    const { jobPostId, customerId } = event.data

    const job = await step.run("fetch-job", async () => {
      const [j] = await db.query.jobPosts.findMany({
        where: (jp: any, { eq: eqFn }: any) => eqFn(jp.id, jobPostId),
        with: { category: { columns: { name: true } } },
        limit: 1,
      })
      return j ?? null
    })

    if (!job) return { skipped: true }

    // Find providers near the job location
    const nearbyProviders = await step.run("find-nearby-providers", async () => {
      return findJobsNearProvider({
        latitude: job.serviceLatitude,
        longitude: job.serviceLongitude,
        radiusKm: job.radiusKm,
        limit: 50,
      })
    })

    if (nearbyProviders.length === 0) return { notified: 0 }

    // Get provider records with userId
    const providerIds = nearbyProviders.map((p: any) => p.jobPostId ? job.id : p)
    const providerRecords = await step.run("fetch-provider-users", async () => {
      return db
        .select({ id: providers.id, userId: providers.userId })
        .from(providers)
        .where(and(eq(providers.isApproved, true), eq(providers.isSuspended, false)))
        .limit(50)
    })

    // Notify each provider via DB + Pusher
    await step.run("notify-providers", async () => {
      for (const provider of providerRecords) {
        await db.insert(notifications).values({
          userId: provider.userId,
          type: "new_job_request",
          title: "New Job Near You!",
          body: `A customer posted a ${job.category?.name ?? "cleaning"} job near you. Check it out!`,
          link: `/jobs/${jobPostId}`,
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

    await step.run("expire-job", async () => {
      const [current] = await db.select({ status: jobPosts.status }).from(jobPosts).where(eq(jobPosts.id, jobPostId))
      if (!current || !["open", "bidding"].includes(current.status)) return
      await db.update(jobPosts).set({ status: "expired" }).where(eq(jobPosts.id, jobPostId))
      await inngest.send({ name: "job/expired", data: { jobPostId } })
    })

    return { notified: providerRecords.length }
  }
)

export const onJobExpired = inngest.createFunction(
  { id: "job-expired", triggers: [{ event: "job/expired" }] },
  async ({ event, step }: { event: { data: { jobPostId: string } }; step: any }) => {
    const { jobPostId } = event.data

    await step.run("reject-pending-bids", async () => {
      await db
        .update(bids)
        .set({ status: "rejected" })
        .where(and(eq(bids.jobPostId, jobPostId), eq(bids.status, "pending")))
    })

    return { jobPostId, expired: true }
  }
)
