import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, notifications, bookingCancellationEvents } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { resolveHold, blockingReason } from "@/lib/stripe/resolveHold"
import { getCancellationConfig } from "@/lib/platform/settings"
import { eq, and } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

const ACTIVE = ["payment_authorized", "confirmed", "in_progress"] as const

// The CLEANER reports the client as unreachable at the appointment. Full charge to the client (the
// cleaner reserved and showed up for the slot), refund €0, cleaner keeps their earnings, logged for
// dispute resolution. Only allowed once the configured grace period past the scheduled start has
// passed, with a required reason — no GPS/contact-attempt tracking, just a time gate + audit trail.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: bookingId } = await params
    if (!isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })
    const { reason } = await req.json().catch(() => ({} as { reason?: string }))
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json({ error: "Please describe what happened (at least 10 characters)." }, { status: 400 })
    }

    const [booking] = await db
      .select({
        id: bookings.id, customerId: bookings.customerId, providerId: bookings.providerId,
        scheduledAt: bookings.scheduledAt, status: bookings.status, totalAmount: bookings.totalAmount,
        platformFeePercent: bookings.platformFeePercent, carbonOffsetAmount: bookings.carbonOffsetAmount,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    const [prov] = await db.select({ id: providers.id, userId: providers.userId }).from(providers).where(and(eq(providers.userId, userId), eq(providers.id, booking.providerId)))
    if (!prov) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

    if (!ACTIVE.includes(booking.status as typeof ACTIVE[number])) {
      return NextResponse.json({ error: "This booking can't be reported as a client no-show right now." }, { status: 422 })
    }

    const cfg = await getCancellationConfig()
    const graceEndsAt = new Date(booking.scheduledAt).getTime() + cfg.noshowGraceMinutes * 60_000
    if (Date.now() < graceEndsAt) {
      return NextResponse.json({ error: `Please wait ${cfg.noshowGraceMinutes} minutes after the scheduled start before reporting a no-show.` }, { status: 422 })
    }

    const [payment] = await db.select({ stripePaymentIntentId: payments.stripePaymentIntentId, status: payments.status }).from(payments).where(eq(payments.bookingId, bookingId))

    const fullHold = booking.totalAmount + (booking.carbonOffsetAmount ?? 0)
    let capturedAmount = 0
    let feeCommission = 0
    if (payment) {
      // Same reason as the cancel route: payments.status is our own mirror and goes stale when
      // Stripe releases a lapsed hold by itself (~7 days), so check the real state before charging.
      // Without this, reporting a no-show on an older booking died with a bare 500.
      const hold = await resolveHold(payment.stripePaymentIntentId)
      const blocked = blockingReason(hold)
      if (blocked) return NextResponse.json({ error: blocked }, { status: 503 })

      if (hold.state === "live") {
        // Full charge: the service portion only (carbon offset is always released, same as a cancel).
        feeCommission = Math.round(booking.totalAmount * (booking.platformFeePercent ?? 0) / 100)
        try {
          await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
            amount_to_capture: booking.totalAmount,
            application_fee_amount: feeCommission,
          }, { idempotencyKey: `noshow-client-${bookingId}` })
        } catch (stripeErr) {
          const detail = stripeErr instanceof Error ? stripeErr.message : "Unknown payment error"
          void logError({
            message: "[bookings/[id]/no-show/client] capture failed", error: stripeErr,
            route: "/api/bookings/[id]/no-show/client", severity: "error", userId, context: { bookingId },
          })
          return NextResponse.json(
            { error: `The no-show was not recorded because the client's payment could not be taken: ${detail}. Please contact support so you are still paid for the slot.` },
            { status: 502 },
          )
        }
        capturedAmount = booking.totalAmount
      } else if (hold.state === "collected") {
        // Already taken (e.g. an earlier retry) — the client has paid in full, which is the intended
        // outcome of a client no-show. Record it rather than charging a second time.
        capturedAmount = booking.totalAmount
        feeCommission = Math.round(booking.totalAmount * (booking.platformFeePercent ?? 0) / 100)
      }
      // "released" / "unpaid" → the hold is gone and there is nothing to take. The no-show is still
      // recorded against the client (that is the point of the report), but the cleaner was not paid,
      // so flag it for admin follow-up rather than silently booking a €0 no-show as settled.
      if (hold.state === "released" || hold.state === "unpaid") {
        void logError({
          message: "[no-show/client] client no-show recorded but the payment hold was already gone — cleaner unpaid",
          route: "/api/bookings/[id]/no-show/client", severity: "warning", userId,
          context: { bookingId, holdState: hold.state },
        })
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(bookings).set({
        status: "client_no_show",
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy: userId,
        ...(capturedAmount > 0 ? { totalAmount: capturedAmount, platformFeeAmount: feeCommission, providerPayout: capturedAmount - feeCommission } : {}),
      }).where(eq(bookings.id, bookingId))
    })

    try {
      await db.insert(bookingCancellationEvents).values({
        bookingId, actorUserId: userId, actorRole: "cleaner", action: "client_no_show",
        scheduledAt: booking.scheduledAt, statusBefore: booking.status,
        cancellationFeeAmount: capturedAmount, travelCompensationAmount: 0,
        refundAmount: fullHold - capturedAmount, reason,
      })
    } catch (auditErr) {
      console.warn("[no-show/client] audit log insert failed:", auditErr)
    }

    try {
      const dt = new Date(booking.scheduledAt).toLocaleString("en-GB")
      await db.insert(notifications).values({
        userId: booking.customerId, type: "booking_cancelled", title: "Booking marked as a no-show",
        body: `Your cleaner reported that you were unavailable for the booking scheduled ${dt}. The full amount was charged. If this is incorrect, please open a dispute.`,
        link: `/bookings/${bookingId}`, metadata: { variant: "booking_cancelled_party", datetime: dt },
      })
    } catch (notifErr) {
      console.warn("[no-show/client] failed to notify client:", notifErr)
    }

    return NextResponse.json({ success: true, charged: capturedAmount })
  } catch (err) {
    console.error("[bookings/[id]/no-show/client POST]", err)
    void logError({ message: "[bookings/[id]/no-show/client POST]", error: err, route: "/api/bookings/[id]/no-show/client", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
