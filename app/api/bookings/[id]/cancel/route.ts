import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { calculateRefundAmount, calculateRefundPercent } from "@/lib/utils/refunds"
import { eq, and } from "drizzle-orm"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: bookingId } = await params
    const { reason } = await req.json()

    const [booking] = await db
      .select({
        id: bookings.id,
        customerId: bookings.customerId,
        providerId: bookings.providerId,
        scheduledAt: bookings.scheduledAt,
        status: bookings.status,
        totalAmount: bookings.totalAmount,
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
    const refundAmount = calculateRefundAmount(booking.totalAmount, hoursUntilJob, callerRole)

    if (payment) {
      if (payment.status === "authorized") {
        // Always cancel the intent to release the card hold, regardless of refund amount
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
      } else if (payment.status === "captured" && refundAmount > 0) {
        await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmount,
        })
      }

      // Bug 9: authorized payments that are cancelled never reach "captured" — use the correct status
      let newPaymentStatus: "cancelled" | "refunded" | "captured" = "captured"
      if (payment.status === "authorized") {
        newPaymentStatus = "cancelled"  // card hold released, no charge
      } else if (refundAmount > 0) {
        newPaymentStatus = "refunded"
      }
      await db.update(payments).set({ status: newPaymentStatus }).where(eq(payments.bookingId, bookingId))
    }

    await db
      .update(bookings)
      .set({
        status: "cancelled",
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
        cancelledBy: userId,
      })
      .where(eq(bookings.id, bookingId))

    return NextResponse.json({ success: true, refundPercent, refundAmount })
  } catch (err) {
    console.error("[bookings/[id]/cancel POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
