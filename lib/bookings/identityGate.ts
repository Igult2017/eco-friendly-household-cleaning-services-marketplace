import { db } from "@/lib/db"
import { bookings, providers, notifications } from "@/lib/db/schema"
import { and, eq, isNotNull } from "drizzle-orm"
import { getIdentityCheckHours, getIdentityMinMinutes } from "@/lib/platform/settings"

// Called the moment a job is awarded to a cleaner, from ALL THREE routes that can award one:
// a cleaner accepting a direct booking, a cleaner claiming an urgent job, and a CLIENT accepting a
// cleaner's bid. That third one is why this is a booking STATE and not a blocked button — the
// cleaner is not the one clicking, so there is no click of theirs to refuse.
//
// An already-verified cleaner is untouched: no prompt, no Stripe call, no cost. Verification is
// charged per cleaner and only ever triggered by real work, which is the point of doing it here
// instead of at sign-up.

/** Leave this much room before the job starts, so a failed check can still be re-awarded in time. */
const REASSIGN_BUFFER_HOURS = 2

export async function requireIdentityOnAward(params: {
  bookingId: string
  providerId: string
}): Promise<{ awaitingIdentity: boolean; dueAt?: Date }> {
  const [prov] = await db
    .select({ userId: providers.userId, verificationStatus: providers.verificationStatus })
    .from(providers)
    .where(eq(providers.id, params.providerId))

  // No provider row should be impossible here, but failing OPEN would silently let an unverified
  // cleaner keep the job — the one outcome this function exists to prevent. Treat it as unverified.
  if (prov?.verificationStatus === "verified") return { awaitingIdentity: false }

  const [bk] = await db
    .select({ scheduledAt: bookings.scheduledAt, bookingNumber: bookings.bookingNumber })
    .from(bookings)
    .where(eq(bookings.id, params.bookingId))
  if (!bk) return { awaitingIdentity: false }

  const [hours, minMinutes] = await Promise.all([getIdentityCheckHours(), getIdentityMinMinutes()])
  const fromNow = Date.now() + hours * 3_600_000
  // Never past the point where there is still time to find someone else. For a job that starts in
  // three hours the cleaner gets one hour, not twelve.
  const lastUseful = new Date(bk.scheduledAt).getTime() - REASSIGN_BUFFER_HOURS * 3_600_000
  // ...but never a deadline that has ALREADY PASSED. For a job starting within the buffer — exactly
  // what the emergency Take Job flow creates — `lastUseful` is behind us, and without this floor the
  // cleaner was handed an expired clock and lost the job on the next sweep without ever getting a
  // chance to verify. The floor may land after such a job's start time, which is correct: an
  // unverified cleaner cannot start the job (isAwaitingIdentity gates it), so the client is
  // protected by the block rather than by racing a hopeless reassignment.
  const floor = Date.now() + minMinutes * 60_000
  const dueAt = new Date(Math.max(floor, Math.min(fromNow, lastUseful)))

  await db.update(bookings).set({ identityCheckDueAt: dueAt }).where(eq(bookings.id, params.bookingId))

  if (prov?.userId) {
    const when = dueAt.toLocaleString("en-GB")
    await db.insert(notifications).values({
      userId: prov.userId,
      type: "provider_approved",
      title: "Verify your identity to keep this job",
      body: `You have been given ${bk.bookingNumber}. Clients are visited in their own homes, so before this job goes ahead we need to confirm who you are: photograph your passport, national ID or driving licence with your camera, then take a photo of your face. It takes about a minute and you only ever do it once. Please complete it by ${when}, or the job will be offered to another verified cleaner.`,
      link: `/provider/bookings`,
      metadata: { variant: "identity_required", bookingId: params.bookingId },
    })
  }

  return { awaitingIdentity: true, dueAt }
}

/**
 * True when this booking is still waiting on its cleaner's identity check — used to hold the job
 * back from proceeding (starting, completing, being paid) until the check passes.
 *
 * Scoped to bookings that actually CARRY a hold, deliberately. "This cleaner is unverified" would
 * be the wrong test: it would freeze every booking made before the check existed.
 */
export async function isAwaitingIdentity(bookingId: string): Promise<boolean> {
  const [row] = await db
    .select({ dueAt: bookings.identityCheckDueAt, status: providers.verificationStatus })
    .from(bookings)
    .leftJoin(providers, eq(providers.id, bookings.providerId))
    .where(eq(bookings.id, bookingId))
  if (!row?.dueAt) return false
  return row.status !== "verified"
}

/** What a cleaner is told when they try to act on a job still waiting on their identity check. */
export const IDENTITY_REQUIRED_MESSAGE =
  "Verify your identity before continuing with this job. Open the job in your bookings and tap " +
  "“Verify my identity” — it takes about a minute and you only ever do it once."

/**
 * The ONE guard for every cleaner action on a job that is still waiting on their identity check.
 *
 * Before this existed, `isAwaitingIdentity` had no callers at all: the hold was recorded, the
 * deadline sweeper could take the job away later, but in the meantime an unverified cleaner could
 * start the job, mark it complete (capturing the client's card) and claim a client no-show fee.
 * The gate was failing OPEN — the single outcome the whole feature exists to prevent.
 *
 * Returns null when the action may proceed, or the 403 to return as-is when it may not.
 */
export async function blockIfAwaitingIdentity(bookingId: string): Promise<Response | null> {
  if (!(await isAwaitingIdentity(bookingId))) return null
  return Response.json(
    { error: IDENTITY_REQUIRED_MESSAGE, identityRequired: true },
    { status: 403 },
  )
}

/**
 * Clears the hold on every job this cleaner is waiting on, once they pass. Called from the Stripe
 * webhook. One statement, and only rows that actually HAVE a hold — so it cannot disturb their
 * other bookings, and the returned ids are exactly the jobs that were released.
 */
export async function clearIdentityHold(providerId: string): Promise<string[]> {
  const released = await db
    .update(bookings)
    .set({ identityCheckDueAt: null })
    .where(and(eq(bookings.providerId, providerId), isNotNull(bookings.identityCheckDueAt)))
    .returning({ id: bookings.id })
  return released.map((r) => r.id)
}
