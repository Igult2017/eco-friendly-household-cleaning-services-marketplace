import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerIdentityVerifications, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { isUuid } from "@/lib/utils/uuid"
import { stripe } from "@/lib/stripe/client"
import { logError } from "@/lib/utils/logError"

/**
 * Give a cleaner their identity-check attempts back.
 *
 * WHY THIS EXISTS: a cleaner who used up their attempts was told to "contact support" — and there
 * was no support path. The only other code touching this table is the delete-provider route, which
 * deliberately REFUSES to run for a cleaner who has bookings. So the exact person most likely to
 * need help, someone with a job on the line, was the one who could not be helped at all, short of
 * editing the database by hand.
 *
 * Does NOT mark anyone verified — it only lets them try again. A cleaner still has to pass.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { id: providerId } = await params
    if (!isUuid(providerId)) return NextResponse.json({ error: "Invalid provider id" }, { status: 400 })

    const [provider] = await db
      .select({ id: providers.id, userId: providers.userId, verificationStatus: providers.verificationStatus })
      .from(providers)
      .where(eq(providers.id, providerId))

    if (!provider) return NextResponse.json({ error: "Cleaner not found" }, { status: 404 })

    // Refuse on an already-verified cleaner: there is nothing to reset, and wiping it would send
    // someone who passed back through a check you would be billed for a second time.
    if (provider.verificationStatus === "verified") {
      return NextResponse.json(
        { error: "This cleaner is already verified — there is nothing to reset." },
        { status: 409 },
      )
    }

    const [record] = await db
      .select({ sessionId: providerIdentityVerifications.stripeVerificationSessionId })
      .from(providerIdentityVerifications)
      .where(eq(providerIdentityVerifications.providerId, providerId))

    // Cancel the old session at Stripe so it can't be resumed and confuse the new attempt. Only
    // possible before it reaches processing/verified; a failure here is not worth blocking on,
    // because the reset below is what actually unblocks the cleaner.
    if (record?.sessionId) {
      try {
        await stripe.identity.verificationSessions.cancel(record.sessionId)
      } catch (err) {
        void logError({
          message: "[admin/identity-reset] could not cancel the old Stripe session",
          error: err,
          severity: "info",
          context: { providerId, sessionId: record.sessionId },
        })
      }
    }

    await db
      .update(providerIdentityVerifications)
      .set({ attempts: 0, status: "not_started", stripeVerificationSessionId: null, updatedAt: new Date() })
      .where(eq(providerIdentityVerifications.providerId, providerId))

    await db
      .update(providers)
      .set({ verificationStatus: "not_started" })
      .where(eq(providers.id, providerId))

    // Tell them, otherwise the reset is invisible and they keep waiting for support.
    await db.insert(notifications).values({
      userId: provider.userId,
      type: "provider_approved",
      title: "You can try your identity check again",
      body: "We've reset your identity check. Open your jobs and tap “Verify my identity” to try again — photograph your ID with your camera in good light, with the whole document in frame.",
      link: "/provider/bookings",
      metadata: { variant: "identity_reset" },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/providers/[id]/identity-reset POST]", err)
    void logError({
      message: "[admin/providers/[id]/identity-reset POST]",
      error: err,
      route: "/api/admin/providers/[id]/identity-reset",
      severity: "error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
