import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { isUuid } from "@/lib/utils/uuid"
import { finalizeUnpaidBooking } from "@/lib/bookings/finalizeUnpaid"
import { logError } from "@/lib/utils/logError"

// The CLIENT confirms the cleaner finished the job. Dual-confirm: this is the second mark — once the
// cleaner has marked done (provider_completed_at) AND the client confirms here, payment is released.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

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
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, userId)))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (booking.clientConfirmedAt) return NextResponse.json({ success: true }) // already confirmed
    if (!booking.providerCompletedAt) {
      return NextResponse.json({ error: "The cleaner hasn't marked this job done yet." }, { status: 422 })
    }
    if (booking.status !== "pending_capture") {
      return NextResponse.json({ error: "This booking can't be confirmed right now." }, { status: 422 })
    }

    // Idempotent: only the first confirm flips the flag (and therefore fires exactly one capture).
    const updated = await db
      .update(bookings)
      .set({ clientConfirmedAt: new Date(), paymentReleasedBy: "client" })
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, userId), eq(bookings.status, "pending_capture")))
      .returning({ id: bookings.id })
    if (updated.length === 0) return NextResponse.json({ success: true })

    const [payment] = await db.select({ stripePaymentIntentId: payments.stripePaymentIntentId }).from(payments).where(eq(payments.bookingId, bookingId))
    if (payment) {
      try {
        await inngest.send({ name: "booking/completed", data: { bookingId, paymentIntentId: payment.stripePaymentIntentId, providerId: booking.providerId, customerId: booking.customerId } })
      } catch (e) {
        console.warn("[confirm-completion] capture send failed:", e)
      }
    } else {
      await finalizeUnpaidBooking(bookingId) // no card on file — nothing to capture, settle directly
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/confirm-completion POST]", err)
    void logError({ message: "[bookings/[id]/confirm-completion POST]", error: err, route: "/api/bookings/[id]/confirm-completion", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
