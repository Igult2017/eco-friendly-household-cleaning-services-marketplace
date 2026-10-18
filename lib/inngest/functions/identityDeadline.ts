import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, providers } from "@/lib/db/schema"
import { and, eq, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm"
import { attemptReassign } from "@/lib/bookings/reassign"
import { requireIdentityOnAward } from "@/lib/bookings/identityGate"
import { refreshIdentityStatus } from "@/lib/stripe/identityStatus"
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

async function handOver(job: { id: string; number: string; providerId: string; businessName: string | null }) {
  // ASK STRIPE FIRST. Our stored status only changes when the webhook lands; if that delivery is
  // missed — or those event types are not enabled on the Stripe endpoint at all — a cleaner who
  // PASSED still looks unverified here, and we would take the job from the one person who did
  // everything asked of them. Re-reading Stripe makes the webhook an accelerator, not a dependency.
  const live = await refreshIdentityStatus(job.providerId)

  // Stripe could not be reached. Acting on a stale "unverified" would punish a cleaner for an
  // outage on our side of the fence, so leave the job alone — the next hourly sweep retries.
  if (!live.live) return { ok: false as const, reason: "stripe_unreachable", skipped: true }

  // They passed. refreshIdentityStatus has already cleared the hold.
  if (live.status === "verified") return { ok: true as const, kept: true }

  // Submitted and still being judged. Never hand a job over mid-decision — wait a round.
  if (live.status === "processing") return { ok: false as const, reason: "still_processing", skipped: true }

  const result = await attemptReassign(job.id, {
    // The client chose this time; swapping the cleaner must not move it.
    keepOriginalSlot: true,
    reason: "identity",
  })

  if (result.ok) {
    // attemptReassign already told the client (after the award) and the old cleaner.
    return { ok: true as const, kept: false }
  }

  // Reaching here means no cleaner at all could take it — not "none verified", since an unverified
  // cleaner is an accepted fallback and simply inherits the check. So this is the genuinely stuck
  // case: nobody nearby, nobody free at that time, or the client's card would not authorise again.
  //
  // DELIBERATELY NOT CANCELLED: the client keeps their booking and their slot, and a human decides.
  // The hold stays set, so the next hourly sweep tries again and this resolves by itself as soon as
  // any cleaner becomes available.
  await alertAdmins(
    `Identity not verified — ${job.number} needs a decision`,
    `${job.businessName ?? "The cleaner"} did not verify their identity for ${job.number}, and no cleaner nearby could take it over (${result.reason}). The client still has their booking at the original time. Either chase this cleaner to verify, assign someone manually, or cancel and refund.`,
    `/admin/bookings`,
  )
  return { ok: false as const, reason: result.reason }
}

/** Bookings an unverified cleaner holds that carry NO identity requirement at all. */
const ACTIVE_STATUSES = ["payment_authorized", "confirmed", "in_progress"] as const

/**
 * Repairs bookings where setting the hold failed at award time.
 *
 * lib/bookings/create.ts wraps requireIdentityOnAward so a failure there can never undo a committed
 * booking and payment — correct — but nothing retried it, so that booking silently carried no
 * identity requirement and the sweeper could not see it. This closes that hole once an hour.
 */
async function reconcileMissingHolds(): Promise<number> {
  const orphans = await db
    .select({ id: bookings.id, providerId: bookings.providerId })
    .from(bookings)
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(
      and(
        isNull(bookings.identityCheckDueAt),
        inArray(bookings.status, [...ACTIVE_STATUSES]),
        ne(providers.verificationStatus, "verified"),
      ),
    )

  let repaired = 0
  for (const o of orphans) {
    try {
      await requireIdentityOnAward({ bookingId: o.id, providerId: o.providerId })
      repaired++
    } catch (err) {
      console.error("[identity-sweep] could not repair a missing identity hold:", o.id, err)
    }
  }
  return repaired
}

export const identityDeadlineSweep = inngest.createFunction(
  { id: "identity-deadline-sweep", retries: 1, triggers: [{ cron: "15 * * * *" }] },
  async ({ step }: { step: any }) => {
    // Repair first, so a booking whose hold never saved is gated from this hour on rather than
    // waiting for someone to notice. It cannot make this run act on those bookings: their fresh
    // deadline is in the future, and the sweep below only looks at ones already past due.
    const repaired = await step.run("repair-missing-identity-holds", reconcileMissingHolds)

    const jobs = await step.run("find-overdue-identity-checks", async () =>
      heldJobs({ pastDueOnly: true }),
    )
    if (jobs.length === 0) return { checked: 0, repaired }

    const outcomes: Array<{ number: string; ok: boolean; reason?: string }> = []
    for (const job of jobs) {
      // One step per job: a failure on one must not stop the rest, and a retry must not re-award a
      // job that already moved.
      const res = await step.run(`hand-over-${job.id}`, async () => handOver(job))
      outcomes.push({ number: job.number, ok: res.ok, reason: "reason" in res ? res.reason : undefined })
    }
    return { checked: jobs.length, repaired, outcomes }
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
