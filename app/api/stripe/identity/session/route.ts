import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerIdentityVerifications, bookings } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { createIdentityCheck, MAX_IDENTITY_ATTEMPTS } from "@/lib/stripe/identity"
import { stripe } from "@/lib/stripe/client"
import { clearIdentityHold } from "@/lib/bookings/identityGate"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Starts the identity check for the signed-in cleaner and returns the secret the in-app pop-up
// needs. Returns a client_secret rather than a hosted URL on purpose: the check opens over the
// cleaner's own job page, so they never leave DORIXÉ.
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db
      .select({ id: providers.id, verificationStatus: providers.verificationStatus })
      .from(providers)
      .where(eq(providers.userId, userId))

    if (!provider) {
      return NextResponse.json({ error: "Provider profile not found" }, { status: 404 })
    }

    // Once verified, never again — this is what keeps the cost one charge per cleaner for life
    // rather than one per job.
    if (provider.verificationStatus === "verified") {
      return NextResponse.json({ alreadyVerified: true })
    }

    // Tie the result to the job that is waiting on it, so the webhook can release exactly that
    // booking. Optional: a cleaner may also verify from their profile with no job pending.
    const body = await req.json().catch(() => ({}) as { bookingId?: string })
    let bookingId: string | undefined
    if (typeof body?.bookingId === "string" && isUuid(body.bookingId)) {
      // Only accept a booking that is actually this cleaner's, so one cleaner's check can never be
      // pointed at another's job.
      const [own] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.id, body.bookingId), eq(bookings.providerId, provider.id)))
      if (own) bookingId = own.id
    }

    const [existing] = await db
      .select({
        id: providerIdentityVerifications.id,
        attempts: providerIdentityVerifications.attempts,
        sessionId: providerIdentityVerifications.stripeVerificationSessionId,
      })
      .from(providerIdentityVerifications)
      .where(eq(providerIdentityVerifications.providerId, provider.id))

    // Stripe bills per SUBMITTED check, pass or fail, so submissions are capped. `attempts` is
    // incremented by the webhook when Stripe reports a real submission — NOT here. Counting
    // openings instead of submissions used to lock a cleaner out after two accidental closes,
    // having charged nothing and checked nothing.
    if (existing && existing.attempts >= MAX_IDENTITY_ATTEMPTS) {
      return NextResponse.json(
        {
          error: "You have used all your identity check attempts. Please contact support.",
          attemptsExhausted: true,
        },
        { status: 429 },
      )
    }

    // Stripe's own guidance: "If a verification process is interrupted, reuse the existing
    // VerificationSession rather than creating a new one." Retrieving it hands back a usable
    // client_secret, so reopening the pop-up costs nothing and burns nothing.
    if (existing?.sessionId) {
      const reused = await reuseSession(existing.sessionId, provider.id)
      if (reused) return reused
    }

    // Keyed per cleaner AND per attempt: a double-submitted request can never create two sessions,
    // while a genuinely new attempt after a cancelled session still gets its own.
    const check = await createIdentityCheck({
      providerId: provider.id,
      bookingId,
      idempotencyKey: `identity-${provider.id}-${existing?.attempts ?? 0}`,
    })

    if (existing) {
      await db
        .update(providerIdentityVerifications)
        .set({ stripeVerificationSessionId: check.id, status: "pending", updatedAt: new Date() })
        .where(eq(providerIdentityVerifications.id, existing.id))
    } else {
      await db.insert(providerIdentityVerifications).values({
        providerId: provider.id,
        stripeVerificationSessionId: check.id,
        status: "pending",
        attempts: 0,
      })
    }

    // Mirrors onto the provider so the rest of the app has one column to read.
    await db.update(providers).set({ verificationStatus: "pending" }).where(eq(providers.id, provider.id))

    return NextResponse.json({ clientSecret: check.clientSecret })
  } catch (err) {
    console.error("[stripe/identity/session POST]", err)
    void logError({
      message: "[stripe/identity/session POST]",
      error: err,
      route: "/api/stripe/identity/session",
      severity: "error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Hand back the cleaner's EXISTING Stripe check rather than starting another one.
 *
 * Returns the response to send, or null to mean "that session is spent — make a new one".
 * A Stripe error also returns null: falling through to a fresh session is the recoverable
 * outcome, where failing the request would leave the cleaner unable to verify at all.
 */
async function reuseSession(sessionId: string, providerId: string): Promise<NextResponse | null> {
  try {
    const session = await stripe.identity.verificationSessions.retrieve(sessionId)

    if (session.status === "verified") {
      // Stripe passed them but our column had not caught up — the webhook never landed. Settle it
      // now and release any job still being held, rather than sending them through a second check.
      await db.update(providers).set({ verificationStatus: "verified" }).where(eq(providers.id, providerId))
      await clearIdentityHold(providerId)
      return NextResponse.json({ alreadyVerified: true })
    }

    if (session.status === "processing") {
      return NextResponse.json({ processing: true, error: "Your identity check is still being reviewed. We'll let you know as soon as it's done." }, { status: 409 })
    }

    // requires_input: either never finished or genuinely failed — both are resumed on the same
    // session, which is exactly what Stripe recommends and what keeps it free until submitted.
    if (session.status === "requires_input" && session.client_secret) {
      return NextResponse.json({ clientSecret: session.client_secret })
    }

    // canceled, redacted, or no usable secret — fall through and create a fresh one.
    return null
  } catch (err) {
    void logError({
      message: "[stripe/identity/session] could not reuse the existing session — creating a new one",
      error: err,
      route: "/api/stripe/identity/session",
      severity: "warning",
      context: { providerId, sessionId },
    })
    return null
  }
}
