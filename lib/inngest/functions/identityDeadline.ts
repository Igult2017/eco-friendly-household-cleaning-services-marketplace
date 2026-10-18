import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, providers } from "@/lib/db/schema"
import { and, eq, isNotNull, lte, ne } from "drizzle-orm"
import { attemptReassign } from "@/lib/bookings/reassign"
import { alertAdmins } from "@/lib/notifications/adminAlert"
import { SITE_URL } from "@/lib/seo/site"

// Takes a job away from a cleaner who did not verify their identity and gives it to one who did.
//
// Two ways in: the hourly sweep (the cleaner simply ran out of time) and the identity/failed event
// (they used up their paid attempts, so waiting out the clock would only delay a known outcome).

/** Jobs still waiting on an unverified cleaner. `onlyProviderId` narrows it to one cleaner. */
async function heldJobs(opts: { pastDueOnly: boolean; onlyProviderId?: string }) {
  const conditions = [
    isNotNull(bookings.identityCheckDueAt),
    // Still unverified. A cleaner who passed between the sweep being scheduled and it running must
    // keep their job — the webhook clears the hold, but belt and braces.
    ne(providers.verificationStatus, "verified"),
  ]
  if (opts.pastDueOnly) conditions.push(lte(bookings.identityCheckDueAt, new Date()))
  if (opts.onlyProviderId) conditions.push(eq(bookings.providerId, opts.onlyProviderId))

  return db
    .select({
      id: bookings.id,
      number: bookings.bookingNumber,
      providerId: bookings.providerId,
      businessName: providers.businessName,
    })
    .from(bookings)
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(and(...conditions))
}

async function handOver(job: { id: string; number: string; businessName: string | null }) {
  const result = await attemptReassign(job.id, {
    // The client chose this time; swapping the cleaner must not move it.
    keepOriginalSlot: true,
    // The whole point of the swap — the replacement must be someone whose identity IS confirmed.
    requireVerified: true,
    reason: "identity",
  })

  if (result.ok) {
    // attemptReassign already told the client (after the award) and the old cleaner.
    return { ok: true as const }
  }

  // DELIBERATELY NOT CANCELLED. The obvious-looking move here is to refund the client and close the
  // booking, but "no verified cleaner nearby" is the NORMAL state until cleaners start verifying —
  // on the day this ships, nobody is verified at all. Auto-cancelling would wipe out every booking
  // on the platform rather than protect anyone.
  //
  // So the job stays where it is, the client keeps their booking and their slot, and a human is told
  // to deal with it. The hold stays set, so this is retried on the next sweep and resolves by itself
  // the moment a verified cleaner is available nearby.
  await alertAdmins(
    `Identity not verified — ${job.number} needs a decision`,
    `${job.businessName ?? "The cleaner"} did not verify their identity for ${job.number}, and no verified cleaner nearby was available to take it (${result.reason}). The client still has their booking at the original time. Either chase this cleaner to verify, assign someone manually, or cancel and refund.`,
    `/admin/bookings`,
  )
  return { ok: false as const, reason: result.reason }
}

export const identityDeadlineSweep = inngest.createFunction(
  { id: "identity-deadline-sweep", retries: 1, triggers: [{ cron: "15 * * * *" }] },
  async ({ step }: { step: any }) => {
    const jobs = await step.run("find-overdue-identity-checks", async () =>
      heldJobs({ pastDueOnly: true }),
    )
    if (jobs.length === 0) return { checked: 0 }

    const outcomes: Array<{ number: string; ok: boolean; reason?: string }> = []
    for (const job of jobs) {
      // One step per job: a failure on one must not stop the rest, and a retry must not re-award a
      // job that already moved.
      const res = await step.run(`hand-over-${job.id}`, async () => handOver(job))
      outcomes.push({ number: job.number, ok: res.ok, reason: "reason" in res ? res.reason : undefined })
    }
    return { checked: jobs.length, outcomes }
  },
)

export const onIdentityFailed = inngest.createFunction(
  { id: "identity-failed", retries: 2, triggers: [{ event: "identity/failed" }] },
  async ({ event, step }: { event: { data: { providerId: string } }; step: any }) => {
    const { providerId } = event.data
    const jobs = await step.run("find-this-cleaners-held-jobs", async () =>
      // Not past-due: their attempts are gone, so the clock no longer matters.
      heldJobs({ pastDueOnly: false, onlyProviderId: providerId }),
    )
    if (jobs.length === 0) return { reassigned: 0 }

    let moved = 0
    for (const job of jobs) {
      const res = await step.run(`hand-over-${job.id}`, async () => handOver(job))
      if (res.ok) moved++
    }
    return { held: jobs.length, reassigned: moved, admin: `${SITE_URL}/admin/bookings` }
  },
)
