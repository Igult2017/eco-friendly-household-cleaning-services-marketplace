import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerIdentityVerifications, bookings } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { createIdentityCheck, MAX_IDENTITY_ATTEMPTS } from "@/lib/stripe/identity"
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
      .select({ id: providerIdentityVerifications.id, attempts: providerIdentityVerifications.attempts })
      .from(providerIdentityVerifications)
      .where(eq(providerIdentityVerifications.providerId, provider.id))

    // Stripe charges for a failed check as well as a passed one, so retries are capped. Past the cap
    // the cleaner is not offered another paid try — the job is re-awarded instead.
    if (existing && existing.attempts >= MAX_IDENTITY_ATTEMPTS) {
      return NextResponse.json(
        {
          error: "You have used all your identity check attempts. Please contact support.",
          attemptsExhausted: true,
        },
        { status: 429 },
      )
    }

    const check = await createIdentityCheck({ providerId: provider.id, bookingId })

    if (existing) {
      await db
        .update(providerIdentityVerifications)
        .set({
          stripeVerificationSessionId: check.id,
          status: "pending",
          attempts: existing.attempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(providerIdentityVerifications.id, existing.id))
    } else {
      await db.insert(providerIdentityVerifications).values({
        providerId: provider.id,
        stripeVerificationSessionId: check.id,
        status: "pending",
        attempts: 1,
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
