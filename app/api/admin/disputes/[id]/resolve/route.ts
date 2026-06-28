import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { disputes, bookings, payments, notifications, providers, carbonOffsetContributions } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { logError } from "@/lib/utils/logError"
import { ensureUserRow } from "@/lib/clerk/ensureUser"

const resolveSchema = z.object({
  outcome: z.enum(["resolved_customer", "resolved_provider"]),
  resolution: z.string().min(10).max(2000),
  refundPercent: z.number().int().min(0).max(100).default(0),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const { adminId: userId } = guard
    // CRITICAL: guarantee the admin's users row exists BEFORE the Stripe refund, so the later
    // UPDATE that sets disputes.assignedAdminId can't violate the FK after money has moved.
    if (!(await ensureUserRow(userId))) return NextResponse.json({ error: "Could not link your admin account. Please reload and try again." }, { status: 500 })

    const { id: disputeId } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = resolveSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { outcome, resolution, refundPercent } = parsed.data

    const [dispute] = await db
      .select({ id: disputes.id, bookingId: disputes.bookingId, status: disputes.status })
      .from(disputes)
      .where(eq(disputes.id, disputeId))
    if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 })
    if (["resolved_customer", "resolved_provider", "closed"].includes(dispute.status)) {
      return NextResponse.json({ error: "Dispute already resolved" }, { status: 422 })
    }

    const [booking] = await db
      .select({ id: bookings.id, totalAmount: bookings.totalAmount, carbonOffsetAmount: bookings.carbonOffsetAmount, customerId: bookings.customerId, providerId: bookings.providerId })
      .from(bookings)
      .where(eq(bookings.id, dispute.bookingId))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    // Refund base = what the customer actually paid (service + carbon offset). totalAmount excludes
    // the offset, so refunding on totalAmount alone short-changed the customer by the offset amount.
    const refundBase = (booking.totalAmount ?? 0) + (booking.carbonOffsetAmount ?? 0)
    const refundAmount = Math.round(refundBase * (refundPercent / 100))

    if (refundPercent > 0) {
      const [payment] = await db
        .select({ stripePaymentIntentId: payments.stripePaymentIntentId, status: payments.status })
        .from(payments)
        .where(eq(payments.bookingId, dispute.bookingId))
      if (payment?.status === "captured") {
        // Bug 7: idempotency key prevents double-refund if server crashes after Stripe responds but before DB update
        await stripe.refunds.create(
          {
            payment_intent: payment.stripePaymentIntentId,
            amount: refundAmount,
            // FIN-005: when the cleaner is at fault (customer wins), claw the
            // refund back from THEIR transfer and refund the platform commission proportionally
            // instead of the platform absorbing 100%. When the provider wins a goodwill refund,
            // the platform absorbs it (no clawback).
            ...(outcome === "resolved_customer"
              ? { reverse_transfer: true, refund_application_fee: true }
              : {}),
          },
          { idempotencyKey: `refund-dispute-${disputeId}` },
        )
        // FIN-005: record the refund on the payment row so the ledger and the customer's
        // booking page reflect it (the field was previously never updated on a dispute refund).
        await db
          .update(payments)
          .set({ refundedAmount: refundAmount, status: refundPercent === 100 ? "refunded" : "partially_refunded" })
          .where(eq(payments.bookingId, dispute.bookingId))
      }
    }

    await db.update(disputes).set({
      status: outcome,
      resolution,
      resolutionAmount: refundAmount,
      assignedAdminId: userId,
      resolvedAt: new Date(),
    }).where(eq(disputes.id, disputeId))

    // Bug 6: a partial refund means the service was disputed — "completed" is misleading for unserviced bookings.
    // Use "cancelled" for any refund outcome (customer wins); only "completed" when provider wins outright (no refund).
    const newBookingStatus =
      refundPercent === 100 ? "refunded" :
      refundPercent > 0    ? "cancelled" :
                             "completed"
    await db.update(bookings).set({ status: newBookingStatus }).where(eq(bookings.id, dispute.bookingId))

    // Customer won a full refund → the carbon offset they paid is returned, so remove the
    // contribution row (keeps the Green-Fund ledger accurate, mirroring the cancellation flow).
    if (outcome === "resolved_customer" && refundPercent === 100) {
      await db.delete(carbonOffsetContributions).where(eq(carbonOffsetContributions.bookingId, dispute.bookingId))
    }

    // Notify both parties. The provider notification must address the cleaner's Clerk user id — NOT
    // the providers-table PK (booking.providerId) — which previously caused an FK violation 500
    // AFTER the refund had already committed.
    await db.insert(notifications).values({
      userId: booking.customerId, type: "dispute_resolved",
      title: "Your dispute has been resolved", body: resolution.slice(0, 120),
      link: `/bookings/${dispute.bookingId}`,
    })
    const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, booking.providerId))
    if (prov?.userId) {
      await db.insert(notifications).values({
        userId: prov.userId, type: "dispute_resolved",
        title: "A dispute on your booking has been resolved", body: resolution.slice(0, 120),
        link: "/provider/bookings",
      })
    }

    return NextResponse.json({ success: true, refundAmount, outcome })
  } catch (err) {
    console.error("[admin/disputes/[id]/resolve POST]", err)
    void logError({ message: "[admin/disputes/[id]/resolve POST]", error: err, route: "/api/admin/disputes/[id]/resolve", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
