import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { eq, and } from "drizzle-orm"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Tiered refund logic
  const hoursUntilJob = (new Date(booking.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60)
  let refundPercent = 0

  if (callerRole === "provider") {
    refundPercent = 100 // provider cancels → always full refund
  } else if (hoursUntilJob > 48) {
    refundPercent = 100
  } else if (hoursUntilJob > 24) {
    refundPercent = 50
  } else {
    refundPercent = 0
  }

  const refundAmount = Math.round(booking.totalAmount * (refundPercent / 100))

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

    await db.update(payments).set({ status: refundAmount > 0 ? "refunded" : "captured" }).where(eq(payments.bookingId, bookingId))
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
}
