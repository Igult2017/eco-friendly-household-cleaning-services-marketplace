import { inngest } from "../client"
import { db } from "@/lib/db"
import { jobPosts, bids, providers, notifications } from "@/lib/db/schema"
import { pusherServer } from "@/lib/pusher/server"
import { findProvidersNearLocation, type GeoProvider } from "@/lib/db/queries/geo"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { formatDistance } from "@/lib/utils/locale"
import { eq, and, inArray } from "drizzle-orm"

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

    const isTakeJob = job.jobType === "take_job"

    // Find eligible providers whose service area overlaps the job location. Take Job additionally
    // requires the provider's own "available for instant jobs" toggle — the whole point is speed, so
    // broadcasting to everyone who merely COULD serve the area (but hasn't opted into emergencies right
    // now) would be noisy and misleading.
    const nearbyProviders = await step.run("find-nearby-providers", async () => {
      return findProvidersNearLocation({
        latitude: job.serviceLatitude,
        longitude: job.serviceLongitude,
        radiusKm: job.radiusKm ?? 25,
        limit: 50,
        requireInstantAvailable: isTakeJob,
      })
    })

    if (nearbyProviders.length === 0) return { notified: 0 }

    // Notify each nearby provider via DB notification + Pusher
    const city     = (job.serviceAddress as { city?: string }).city ?? "your area"
    const category = job.category?.name ?? "cleaning"
    const country  = (job.serviceAddress as { country?: string }).country ?? "DE"

    await step.run("notify-providers", async () => {
      const nearby = nearbyProviders as GeoProvider[]

      let budgetText = ""
      if (job.budgetMin && job.budgetMax) {
        budgetText = ` · Budget: ${formatCurrencyForCountry(job.budgetMin, country)}–${formatCurrencyForCountry(job.budgetMax, country)}`
      }

      // Batch-insert all notifications in one round-trip instead of N sequential inserts. Take Job
      // reuses the same new_job_request type (a metadata.variant flag distinguishes copy/urgency at
      // render time) rather than a dedicated enum value — it IS still "a new job is available."
      const notifValues = nearby.map((p) => {
        const distance = formatDistance((p.distanceMeters ?? 0) / 1000, p.country || country)
        return {
          userId: p.userId,
          type:   "new_job_request" as const,
          title:  isTakeJob ? `🚨 Emergency ${category} job in ${city}` : `New ${category} job in ${city}`,
          body:   isTakeJob
            ? `An emergency ${category} job needs a cleaner NOW in ${city}${budgetText}. They are ${distance} from you — first to claim it gets it!`
            : `A customer needs ${category} help in ${city}${budgetText}. They are ${distance} from you — be one of the first to bid!`,
          link:   "/provider/jobs",
          metadata: { category, city, distance, variant: isTakeJob ? "take_job" : "standard" },
        }
      })

      if (notifValues.length > 0) {
        await db.insert(notifications).values(notifValues)
      }

      // Pusher is non-critical — fire all in parallel, ignore failures. Take Job fires a DISTINCT event
      // name so client-side realtime listening (a toast) reacts only to emergencies, not every post.
      const eventName = isTakeJob ? "take-job-available" : "new-job"
      await Promise.all(nearby.map((p) =>
        pusherServer
          .trigger(`private-provider-${p.id}`, eventName, {
            jobPostId, title: job.title, city, categoryName: category,
          })
          .catch(() => undefined)
      ))
    })

    // Take Job is meant to resolve fast — claimed or manually cancelled by the client, not left to
    // time out on a 72h timer that doesn't fit an emergency. Normal jobs also don't really expire in
    // practice (expiresAt defaults ~100 years out), so skipping this for take_job isn't a regression.
    if (isTakeJob) return { notified: nearbyProviders.length }

    // Schedule expiry in 72 hours
    await step.sleep("wait-72h", "72 hours")

    // INN-005: update DB in one step, send event in a separate step so both are checkpointed
    const shouldExpire = await step.run("expire-job", async () => {
      const [current] = await db.select({ status: jobPosts.status, expiresAt: jobPosts.expiresAt }).from(jobPosts).where(eq(jobPosts.id, jobPostId))
      if (!current || !["open", "bidding"].includes(current.status)) return false
      // Jobs no longer auto-expire on a timer — only if the (far-future by default) expires_at has
      // actually passed. So an open post stays on the board until the customer accepts a cleaner or
      // cancels it; with the default expiry this never fires (also covers posts whose 72h timer was
      // already scheduled before this change, since the step re-runs with this logic on resume).
      if (new Date(current.expiresAt) > new Date()) return false
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
        .where(inArray(providers.id, pendingBids.map((b) => b.providerId)))

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

    // Notify each rejected bidder — single batch insert
    if (rejectedProviderUserIds.length > 0) {
      await step.run("notify-bidders", async () => {
        await db.insert(notifications).values(
          rejectedProviderUserIds.map((userId: string) => ({
            userId,
            type: "booking_cancelled" as const,
            title: "Job post expired",
            body: "A job you bid on has expired without a decision. Keep an eye out for new jobs!",
            link: "/provider/jobs",
          }))
        )
      })
    }

    return { jobPostId, expired: true, biddersNotified: rejectedProviderUserIds.length }
  }
)
