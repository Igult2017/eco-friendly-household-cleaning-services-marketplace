import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, promoCodes, promoCodeUsages, carbonOffsetContributions, referralCredits } from "@/lib/db/schema"
import { describeHoldOutcome, type HoldState } from "@/lib/stripe/resolveHold"
import { settleCancellation } from "@/lib/bookings/settleCancellation"
import { recordCancellationNotices } from "@/lib/bookings/cancellationNotices"
import { calculateCancellationFeeLive, CANCELLATION_REASON_CATEGORIES, type CancellationReasonCategory } from "@/lib/utils/refunds"
import { getCancellationConfig } from "@/lib/platform/settings"
import { eq, and, sql } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: bookingId } = await params
    if (!isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })
    const { reason, reasonCategory: rawCategory } = await req
      .json()
      .catch(() => ({} as { reason?: string; reasonCategory?: string }))
    // Only a category we recognise can waive a fee — anything else is treated as "other", so a
    // made-up value in the request body can never buy a free late cancellation.
    const reasonCategory: CancellationReasonCategory =
      CANCELLATION_REASON_CATEGORIES.includes(rawCategory as CancellationReasonCategory)
        ? (rawCategory as CancellationReasonCategory)
        : "other"

    const [booking] = await db
      .select({
        id: bookings.id,
        customerId: bookings.customerId,
        providerId: bookings.providerId,
        scheduledAt: bookings.scheduledAt,
        status: bookings.status,
        totalAmount: bookings.totalAmount,
        platformFeePercent: bookings.platformFeePercent,
        carbonOffsetAmount: bookings.carbonOffsetAmount,
        promoCodeId: bookings.promoCodeId,
        referralCreditAppliedCents: bookings.referralCreditAppliedCents,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    // Check caller is customer or the provider
    let callerRole: "customer" | "provider" = "customer"
    if (booking.customerId !== userId) {
      const [prov] = await db.select({ id: providers.id }).from(providers).where(and(eq(providers.userId, userId), eq(providers.id, booking.providerId)))
      if (!prov) return NextResponse.json({ error: "Not authorized" }, { status: 403 })
      callerRole = "provider"
    }

    if (!["payment_authorized", "confirmed"].includes(booking.status)) {
      return NextResponse.json({ error: "Booking cannot be cancelled" }, { status: 422 })
    }

    const [payment] = await db
      .select({ stripePaymentIntentId: payments.stripePaymentIntentId, status: payments.status })
      .from(payments)
      .where(eq(payments.bookingId, bookingId))

    const hoursUntilJob = (new Date(booking.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60)

    // Outside the free-cancel window (same live, admin-configurable cutoff the fee tiers already
    // use — not a separate hardcoded number), a reason is required from whoever cancels. Applies to
    // both roles equally — a late cancellation is disruptive for the other side either way.
    const { tier1Hours } = await getCancellationConfig()
    if (hoursUntilJob < tier1Hours && (!reason || reason.trim().length < 10)) {
      return NextResponse.json(
        { error: { fieldErrors: { reason: [`Please give a reason (at least 10 characters) — this booking is within ${tier1Hours} hours of the appointment.`] } } },
        { status: 422 },
      )
    }

    const { refundPercent, feePercent, travelCompensationCents, cancellerFeePercent } =
      await calculateCancellationFeeLive(hoursUntilJob, callerRole, reasonCategory)
    // Non-refundable SERVICE portion = the cancellation fee (the carbon offset is always released).
    const feeAmount = Math.round(booking.totalAmount * feePercent / 100)
    const fullHold = booking.totalAmount + (booking.carbonOffsetAmount ?? 0)
    // Travel compensation is an ADDITIONAL charge on a very-late client cancellation, paid straight to
    // the cleaner (no platform commission on it) — clamped to whatever headroom the original
    // authorized hold still has, since Stripe can never capture beyond what was authorized.
    const travelComp = Math.max(0, Math.min(travelCompensationCents, fullHold - feeAmount))

    let newPaymentStatus: "cancelled" | "refunded" | "partially_refunded" | "captured" = "cancelled"
    let capturedFee = 0
    let capturedTravelComp = 0
    let feeCommission = 0
    let holdState: HoldState = "unpaid"
    if (payment?.stripePaymentIntentId) {
      const settled = await settleCancellation({
        bookingId,
        paymentIntentId: payment.stripePaymentIntentId,
        feeAmount, travelComp, fullHold,
        platformFeePercent: booking.platformFeePercent ?? 0,
        userId,
      })
      if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: settled.status })
      ;({ paymentStatus: newPaymentStatus, capturedFee, capturedTravelComp, feeCommission, holdState } = settled)
    }

    // BUG-004: commit payment + booking status together so money state can't diverge from the booking.
    await db.transaction(async (tx) => {
      if (payment) {
        await tx.update(payments).set({
          status: newPaymentStatus,
          ...(capturedFee > 0 ? { capturedAmount: capturedFee, capturedAt: new Date() } : {}),
        }).where(eq(payments.bookingId, bookingId))
      }
      await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancellationReason: reason ?? null,
          cancelledAt: new Date(),
          cancelledBy: userId,
          // When a late-cancel fee was captured, restate the money fields to what actually moved so
          // earnings/ledger reads don't report the original (never-collected) full payout. Travel
          // comp passes to the cleaner in full (no commission), so it's added straight to the payout.
          ...(capturedFee > 0 || capturedTravelComp > 0
            ? {
                totalAmount: feeAmount + capturedTravelComp,
                platformFeeAmount: feeCommission,
                providerPayout: feeAmount - feeCommission + capturedTravelComp,
                travelCompensationAmount: capturedTravelComp,
              }
            : {}),
        })
        .where(eq(bookings.id, bookingId))

      // Give the promo back — a cancelled booking delivered no service, so don't burn the user's
      // redemption or the global count.
      if (booking.promoCodeId) {
        await tx.update(promoCodes).set({ usedCount: sql`GREATEST(used_count - 1, 0)` }).where(eq(promoCodes.id, booking.promoCodeId))
        await tx.delete(promoCodeUsages).where(eq(promoCodeUsages.bookingId, bookingId))
      }
      // The carbon-offset hold was released (never captured), so the contribution wasn't collected.
      await tx.delete(carbonOffsetContributions).where(eq(carbonOffsetContributions.bookingId, bookingId))

      // Give the spent referral balance back too — same principle as the promo code above: the
      // service never happened, so the discount the customer "paid for" it with is returned.
      if (booking.referralCreditAppliedCents > 0) {
        await tx
          .update(referralCredits)
          .set({ balanceCents: sql`referral_credits.balance_cents + ${booking.referralCreditAppliedCents}`, updatedAt: new Date() })
          .where(eq(referralCredits.userId, booking.customerId))
      }
    })

    // "Refunded" means money that actually went back. When the hold had already lapsed (or was never
    // taken) nothing was held, so nothing was returned — recording the full amount would put a refund
    // that never happened into the record a dispute is decided on.
    const moneyWasHeld = holdState === "live" || holdState === "collected"
    const refundedAmount = moneyWasHeld ? fullHold - capturedFee - capturedTravelComp : 0
    // What the canceller is liable for. For a client that is the money actually taken off their card.
    // For a CLEANER nothing is taken — the client is refunded in full and must never pay for someone
    // else's cancellation — so the amount is recorded against the cleaner instead of charged.
    const cancellerLiability =
      callerRole === "provider" ? Math.round(booking.totalAmount * cancellerFeePercent / 100) : capturedFee

    await recordCancellationNotices({
      bookingId, userId, callerRole,
      customerId: booking.customerId,
      providerId: booking.providerId,
      scheduledAt: booking.scheduledAt,
      statusBefore: booking.status,
      reason, reasonCategory, cancellerLiability,
      travelCompensation: capturedTravelComp,
      refundAmount: refundedAmount,
      tier1Hours, hoursUntilJob,
    })

    return NextResponse.json({
      success: true,
      refundPercent,
      feeCharged: capturedFee,
      travelCompensationCharged: capturedTravelComp,
      refundedAmount,
      paymentOutcome: describeHoldOutcome(holdState),
    })
  } catch (err) {
    // Everything that can fail for a reason the caller can act on is handled above with its own
    // message. Reaching here means something genuinely unexpected broke (database, config), so the
    // booking was NOT cancelled — say that plainly instead of the bare "Internal server error" that
    // used to cover every failure in this route and told nobody anything.
    console.error("[bookings/[id]/cancel POST]", err)
    void logError({ message: "[bookings/[id]/cancel POST]", error: err, route: "/api/bookings/[id]/cancel", severity: "error" })
    return NextResponse.json(
      { error: "Something went wrong on our side and the booking was not cancelled. Nothing has been charged. Please try again — if it keeps happening, contact support." },
      { status: 500 },
    )
  }
}
