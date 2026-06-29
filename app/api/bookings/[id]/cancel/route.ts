import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, promoCodes, promoCodeUsages, carbonOffsetContributions, notifications } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { calculateRefundPercent } from "@/lib/utils/refunds"
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
    const { reason } = await req.json().catch(() => ({} as { reason?: string }))

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
    const refundPercent = calculateRefundPercent(hoursUntilJob, callerRole)
    // Non-refundable SERVICE portion = the cancellation fee (the carbon offset is always released).
    const feeAmount = Math.round(booking.totalAmount * (100 - refundPercent) / 100)
    const fullHold = booking.totalAmount + (booking.carbonOffsetAmount ?? 0)

    let newPaymentStatus: "cancelled" | "refunded" | "partially_refunded" | "captured" = "cancelled"
    let capturedFee = 0
    let feeCommission = 0
    if (payment) {
      // Idempotency keys: a retry after a partial failure must NOT charge / release twice (BUG-004).
      if (payment.status === "authorized") {
        if (feeAmount > 0) {
          // Late cancel: capture only the fee (Stripe releases the rest of the hold, incl. the carbon
          // offset). Split like a normal job — platform keeps its commission, the cleaner is
          // compensated for the slot they reserved.
          feeCommission = Math.round(feeAmount * (booking.platformFeePercent ?? 0) / 100)
          await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
            amount_to_capture: feeAmount,
            application_fee_amount: feeCommission,
          }, { idempotencyKey: `cancel-fee-${bookingId}` })
          newPaymentStatus = "captured"
          capturedFee = feeAmount
        } else {
          // Full refund (early cancel, or provider-initiated) → release the entire hold.
          await stripe.paymentIntents.cancel(payment.stripePaymentIntentId, {}, { idempotencyKey: `cancel-${bookingId}` })
          newPaymentStatus = "cancelled"
        }
      } else if (payment.status === "captured") {
        // Rare (cancel is gated to pre-capture states) — refund the refundable portion incl. offset.
        const refundCents = Math.max(0, fullHold - feeAmount)
        if (refundCents > 0) {
          await stripe.refunds.create(
            { payment_intent: payment.stripePaymentIntentId, amount: refundCents },
            { idempotencyKey: `refund-${bookingId}` },
          )
        }
        newPaymentStatus = refundCents >= fullHold ? "refunded" : "partially_refunded"
      }
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
          // earnings/ledger reads don't report the original (never-collected) full payout.
          ...(capturedFee > 0 ? { totalAmount: feeAmount, platformFeeAmount: feeCommission, providerPayout: feeAmount - feeCommission } : {}),
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
    })

    // Notify the OTHER party — the canceller already knows. (booking_cancelled base copy means
    // "Payment failed", so use the booking_cancelled_party variant for a proper localized message.)
    try {
      const dt = new Date(booking.scheduledAt).toLocaleString("en-GB")
      if (callerRole === "customer") {
        const [pv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, booking.providerId))
        if (pv) {
          await db.insert(notifications).values({
            userId: pv.userId, type: "booking_cancelled", title: "Booking cancelled",
            body: `A booking scheduled for ${dt} was cancelled by the client.`,
            link: "/provider/bookings", metadata: { variant: "booking_cancelled_party", datetime: dt },
          })
        }
      } else {
        await db.insert(notifications).values({
          userId: booking.customerId, type: "booking_cancelled", title: "Booking cancelled",
          body: `Your booking scheduled for ${dt} was cancelled.`,
          link: "/dashboard", metadata: { variant: "booking_cancelled_party", datetime: dt },
        })
      }
    } catch (notifErr) {
      console.warn("[cancel] failed to notify other party:", notifErr)
    }

    return NextResponse.json({ success: true, refundPercent, feeCharged: capturedFee, refundedAmount: fullHold - capturedFee })
  } catch (err) {
    console.error("[bookings/[id]/cancel POST]", err)
    void logError({ message: "[bookings/[id]/cancel POST]", error: err, route: "/api/bookings/[id]/cancel", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
