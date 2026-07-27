import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, notifications, bookingCancellationEvents } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { getCancellationConfig } from "@/lib/platform/settings"
import { eq } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"
import { clawbackReferralCommission } from "@/lib/referrals/clawback"

const ACTIVE = ["payment_authorized", "confirmed", "in_progress"] as const

// The CLIENT reports the cleaner never arrived. Full refund, no charge, and the cleaner's own
// userId is recorded as cancelledBy so it counts against their reliability score exactly like an
// own cancellation. Only allowed once the configured grace period past the scheduled start has
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
        carbonOffsetAmount: bookings.carbonOffsetAmount,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (booking.customerId !== userId) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

    if (!ACTIVE.includes(booking.status as typeof ACTIVE[number])) {
      return NextResponse.json({ error: "This booking can't be reported as a cleaner no-show right now." }, { status: 422 })
    }

    const cfg = await getCancellationConfig()
    const graceEndsAt = new Date(booking.scheduledAt).getTime() + cfg.noshowGraceMinutes * 60_000
    if (Date.now() < graceEndsAt) {
      return NextResponse.json({ error: `Please wait ${cfg.noshowGraceMinutes} minutes after the scheduled start before reporting a no-show.` }, { status: 422 })
    }

    const [payment] = await db.select({ stripePaymentIntentId: payments.stripePaymentIntentId, status: payments.status }).from(payments).where(eq(payments.bookingId, bookingId))
    const fullHold = booking.totalAmount + (booking.carbonOffsetAmount ?? 0)

    let newPaymentStatus: "cancelled" | "refunded" = "cancelled"
    if (payment) {
      if (payment.status === "authorized") {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId, {}, { idempotencyKey: `noshow-cleaner-${bookingId}` })
        newPaymentStatus = "cancelled"
      } else if (payment.status === "captured") {
        await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId, amount: fullHold }, { idempotencyKey: `noshow-cleaner-refund-${bookingId}` })
        await clawbackReferralCommission(bookingId)
        newPaymentStatus = "refunded"
      }
    }

    const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, booking.providerId))

    await db.transaction(async (tx) => {
      if (payment) {
        await tx.update(payments).set({ status: newPaymentStatus }).where(eq(payments.bookingId, bookingId))
      }
      await tx.update(bookings).set({
        status: "cleaner_no_show",
        cancellationReason: reason,
        cancelledAt: new Date(),
        // Attributed to the CLEANER so it counts against their reliability score, even though the
        // client is the one filing the report.
        cancelledBy: prov?.userId ?? userId,
      }).where(eq(bookings.id, bookingId))
    })

    try {
      await db.insert(bookingCancellationEvents).values({
        bookingId, actorUserId: userId, actorRole: "client", action: "cleaner_no_show",
        scheduledAt: booking.scheduledAt, statusBefore: booking.status,
        cancellationFeeAmount: 0, travelCompensationAmount: 0,
        refundAmount: fullHold, reason,
      })
    } catch (auditErr) {
      console.warn("[no-show/cleaner] audit log insert failed:", auditErr)
    }

    try {
      if (prov?.userId) {
        const dt = new Date(booking.scheduledAt).toLocaleString("en-GB")
        await db.insert(notifications).values({
          userId: prov.userId, type: "booking_cancelled", title: "Booking marked as a no-show",
          body: `The client reported you didn't show up for the booking scheduled ${dt}. The client was fully refunded. If this is incorrect, please open a dispute.`,
          link: "/provider/bookings", metadata: { variant: "booking_cancelled_party", datetime: dt },
        })
      }
    } catch (notifErr) {
      console.warn("[no-show/cleaner] failed to notify cleaner:", notifErr)
    }

    return NextResponse.json({ success: true, refundedAmount: fullHold })
  } catch (err) {
    console.error("[bookings/[id]/no-show/cleaner POST]", err)
    void logError({ message: "[bookings/[id]/no-show/cleaner POST]", error: err, route: "/api/bookings/[id]/no-show/cleaner", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
