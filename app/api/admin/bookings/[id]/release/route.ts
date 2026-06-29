import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Admin manual release — for when the cleaner has proof the job is done but the client is unavailable
// to confirm. Satisfies the dual-confirm gate on the client's behalf and releases payment.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
    if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id: bookingId } = await params
    if (!isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })

    const [booking] = await db
      .select({
        status: bookings.status,
        customerId: bookings.customerId,
        providerId: bookings.providerId,
        providerCompletedAt: bookings.providerCompletedAt,
        clientConfirmedAt: bookings.clientConfirmedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (booking.clientConfirmedAt) return NextResponse.json({ success: true })
    if (!booking.providerCompletedAt) {
      return NextResponse.json({ error: "The cleaner hasn't marked this job done — no proof to release against." }, { status: 422 })
    }
    if (booking.status !== "pending_capture") {
      return NextResponse.json({ error: "This booking isn't awaiting release." }, { status: 422 })
    }

    const updated = await db
      .update(bookings)
      .set({ clientConfirmedAt: new Date(), paymentReleasedBy: "admin" })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending_capture")))
      .returning({ id: bookings.id })
    if (updated.length === 0) return NextResponse.json({ success: true })

    const [payment] = await db.select({ stripePaymentIntentId: payments.stripePaymentIntentId }).from(payments).where(eq(payments.bookingId, bookingId))
    if (payment) {
      try {
        await inngest.send({ name: "booking/completed", data: { bookingId, paymentIntentId: payment.stripePaymentIntentId, providerId: booking.providerId, customerId: booking.customerId } })
      } catch (e) {
        console.warn("[admin release] capture send failed:", e)
      }
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/bookings/[id]/release POST]", err)
    void logError({ message: "[admin/bookings/[id]/release POST]", error: err, route: "/api/admin/bookings/[id]/release", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
