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

  // Bug 7: fail loudly if R2 is not configured — silent filtering would drop all photos
  const R2_BASE = process.env.R2_PUBLIC_URL
  if (!R2_BASE) return NextResponse.json({ error: "File storage not configured" }, { status: 500 })

  // Bug 4: reject suspended providers — they must not be able to trigger payment capture
  const [provider] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(and(eq(providers.userId, userId), eq(providers.isSuspended, false)))

  if (!provider) return NextResponse.json({ error: "Not a provider or account suspended" }, { status: 403 })

  const [booking] = await db
    .select({ id: bookings.id, status: bookings.status, customerId: bookings.customerId, providerId: bookings.providerId })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)))

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  if (!["payment_authorized", "confirmed", "in_progress"].includes(booking.status)) {
    return NextResponse.json({ error: "Booking cannot be completed in its current state" }, { status: 422 })
  }

  const body = await req.json()
  const rawUrls: unknown[] = Array.isArray(body.photoUrls) ? body.photoUrls : []

  // Only accept URLs from our own R2 bucket to prevent stored XSS via external URLs
  const photoUrls = rawUrls.filter(
    (u): u is string => typeof u === "string" && u.startsWith(R2_BASE),
  )

  // Bug 2: set to pending_capture, not completed — Inngest sets completed after capture succeeds
  await db
    .update(bookings)
    .set({ status: "pending_capture", completionPhotoUrls: photoUrls, actualEndAt: new Date() })
    .where(eq(bookings.id, bookingId))

  const [payment] = await db
    .select({ stripePaymentIntentId: payments.stripePaymentIntentId })
    .from(payments)
    .where(eq(payments.bookingId, bookingId))

  if (!payment) return NextResponse.json({ error: "Payment record not found" }, { status: 500 })

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
