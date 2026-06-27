import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, notifications, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: bookingId } = await params
    if (!isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })

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

    // Atomic conditional update — only succeeds if status is still 'confirmed'
    const updated = await db
      .update(bookings)
      .set({ status: "in_progress", actualStartAt: new Date() })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.providerId, provider.id),
          eq(bookings.status, "confirmed")
        )
      )
      .returning({ id: bookings.id })

    if (updated.length === 0) {
      return NextResponse.json({ error: "Booking cannot be started in its current state" }, { status: 409 })
    }

    await db.insert(notifications).values({
      userId: booking.customerId,
      type: "booking_started",
      title: "Your cleaner has arrived!",
      body: "Your cleaning session has begun.",
      link: `/bookings/${bookingId}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/start POST]", err)
    void logError({ message: "[bookings/[id]/start POST]", error: err, route: "/api/bookings/[id]/start", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
