import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, notifications, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: bookingId } = await params

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

  // Atomic conditional update — only succeeds if status is still 'payment_authorized'
  const updated = await db
    .update(bookings)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.providerId, provider.id),
        eq(bookings.status, "payment_authorized")
      )
    )
    .returning({ id: bookings.id })

  if (updated.length === 0) {
    return NextResponse.json({ error: "Booking cannot be confirmed in its current state" }, { status: 409 })
  }

  await db.insert(notifications).values({
    userId: booking.customerId,
    type: "booking_confirmed",
    title: "Your booking has been confirmed!",
    body: "Your cleaning provider has confirmed your booking.",
    link: `/bookings/${bookingId}`,
  })

  return NextResponse.json({ success: true })
}
