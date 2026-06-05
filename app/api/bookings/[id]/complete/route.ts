import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: bookingId } = await params

  // Verify caller is the provider for this booking
  const [provider] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) return NextResponse.json({ error: "Not a provider" }, { status: 403 })

  const [booking] = await db
    .select({ id: bookings.id, status: bookings.status, customerId: bookings.customerId, providerId: bookings.providerId })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)))

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  if (!["payment_authorized", "confirmed", "in_progress"].includes(booking.status)) {
    return NextResponse.json({ error: "Booking cannot be completed in its current state" }, { status: 422 })
  }

  const body = await req.json()
  const photoUrls: string[] = body.photoUrls ?? []

  // Update booking with photos + status
  await db
    .update(bookings)
    .set({ status: "completed", completionPhotoUrls: photoUrls, actualEndAt: new Date() })
    .where(eq(bookings.id, bookingId))

  // Fetch payment intent ID
  const [payment] = await db
    .select({ stripePaymentIntentId: payments.stripePaymentIntentId })
    .from(payments)
    .where(eq(payments.bookingId, bookingId))

  if (!payment) return NextResponse.json({ error: "Payment record not found" }, { status: 500 })

  // Fire Inngest to capture payment async
  await inngest.send({
    name: "booking/completed",
    data: {
      bookingId,
      paymentIntentId: payment.stripePaymentIntentId,
      providerId: provider.id,
      customerId: booking.customerId,
    },
  })

  return NextResponse.json({ success: true })
}
