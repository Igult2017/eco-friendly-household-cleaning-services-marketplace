import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, notifications, bookingCancellationEvents } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
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
    if (payment?.status === "authorized") {
      // Full charge: the service portion only (carbon offset is always released, same as a cancel).
      feeCommission = Math.round(booking.totalAmount * (booking.platformFeePercent ?? 0) / 100)
      await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
        amount_to_capture: booking.totalAmount,
        application_fee_amount: feeCommission,
      }, { idempotencyKey: `noshow-client-${bookingId}` })
      capturedAmount = booking.totalAmount
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
