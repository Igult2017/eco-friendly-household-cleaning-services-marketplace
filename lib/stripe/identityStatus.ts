import { db } from "@/lib/db"
import { providers, providerIdentityVerifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "./client"
import { clearIdentityHold } from "@/lib/bookings/identityGate"
import { logError } from "@/lib/utils/logError"

/**
 * What Stripe's answer means, in our words.
 *
 * "processing" (submitted, being judged) is NOT one of the values `providers.verificationStatus`
 * can hold — that column is a Postgres enum, and widening it would mean a schema change for no
 * behavioural gain. So it is stored as "pending" on the provider, kept in full on the verification
 * record (a plain text column), and — the part that matters — returned live to the caller, because
 * the sweeper's decision to leave a job alone mid-decision is made on this value, not the column.
 */
export type IdentityStatus =
  | "not_started"
  | "pending"
  | "processing"
  | "verified"
  | "requires_resubmission"

/** The same status narrowed to what the `providers.verificationStatus` enum accepts. */
type StoredIdentityStatus = Exclude<IdentityStatus, "processing">

function forProviderColumn(status: IdentityStatus): StoredIdentityStatus {
  return status === "processing" ? "pending" : status
}

/** Stripe must answer within this, or we act on what we already knew. */
const LOOKUP_TIMEOUT_MS = 5000

/**
 * Ask Stripe what a cleaner's identity check actually says, and write the answer down.
 *
 * WHY THIS EXISTS: before it, the ONLY route from "Stripe says verified" into our database was the
 * `identity.verification_session.verified` webhook. A missed delivery — or those event types simply
 * not being ticked on the Stripe endpoint — meant a cleaner who PASSED kept a hold on their job and
 * the deadline sweeper took the work away from them. One missed message, and we punish the person
 * who did everything right.
 *
 * With this, the webhook is an accelerator rather than a dependency: it makes the release instant,
 * but the sweeper re-reads Stripe before it takes anything away, so the right answer is reached
 * either way.
 *
 * FAILURE RULE: if Stripe is slow or unreachable, return what we already had and change NOTHING.
 * A Stripe outage must never be the reason a cleaner loses a job.
 */
export async function refreshIdentityStatus(providerId: string): Promise<{
  status: IdentityStatus
  releasedBookingIds: string[]
  /** False when Stripe could not be reached — the caller must not treat the status as fresh. */
  live: boolean
}> {
  const [stored] = await db
    .select({ status: providers.verificationStatus })
    .from(providers)
    .where(eq(providers.id, providerId))

  const current = (stored?.status as IdentityStatus) ?? "not_started"

  // Verified is terminal — Stripe cannot un-verify someone, so never spend a call re-asking.
  if (current === "verified") return { status: "verified", releasedBookingIds: [], live: true }

  const [record] = await db
    .select({ sessionId: providerIdentityVerifications.stripeVerificationSessionId })
    .from(providerIdentityVerifications)
    .where(eq(providerIdentityVerifications.providerId, providerId))

  // Never started a check — nothing to ask Stripe about.
  if (!record?.sessionId) return { status: current, releasedBookingIds: [], live: true }

  try {
    const session = await withTimeout(
      stripe.identity.verificationSessions.retrieve(record.sessionId),
      LOOKUP_TIMEOUT_MS,
    )
    const mapped = mapStripeStatus(session.status)

    if (mapped !== current) {
      await db
        .update(providers)
        .set({ verificationStatus: forProviderColumn(mapped) })
        .where(eq(providers.id, providerId))
      // The verification record keeps the exact word, including "processing".
      await db
        .update(providerIdentityVerifications)
        .set({ status: mapped, updatedAt: new Date() })
        .where(eq(providerIdentityVerifications.providerId, providerId))
    }

    // Passing releases every job that was waiting on this cleaner. Safe to run even when the
    // webhook already did it — clearIdentityHold only touches rows that still carry a hold.
    const releasedBookingIds = mapped === "verified" ? await clearIdentityHold(providerId) : []

    return { status: mapped, releasedBookingIds, live: true }
  } catch (err) {
    void logError({
      message: "[identityStatus] could not read the identity check from Stripe",
      error: err,
      severity: "warning",
      context: { providerId, sessionId: record.sessionId, stored: current },
    })
    return { status: current, releasedBookingIds: [], live: false }
  }
}

/** Stripe's session status in our own words. */
export function mapStripeStatus(status: string): IdentityStatus {
  switch (status) {
    case "verified":
      return "verified"
    // Submitted and being decided. NOT a failure, and specifically not a reason to take the job
    // away — the sweeper waits another round rather than acting mid-decision.
    case "processing":
      return "processing"
    // Stripe needs something more: a genuine failure, or a check that was never finished.
    case "requires_input":
      return "requires_resubmission"
    case "canceled":
      return "not_started"
    default:
      return "pending"
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Stripe identity lookup exceeded ${ms}ms`)), ms),
    ),
  ])
}
