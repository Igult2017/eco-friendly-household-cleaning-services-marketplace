import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, providers } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"
import { stampProviderLastActive } from "@/lib/providers/lastActive"

const ACTIVE = ["payment_authorized", "confirmed", "in_progress"] as const

// The cleaner answering "yes, I am still coming" to the check sent a few hours before the job.
// Answering stops the automatic reassignment that would otherwise take the job away.
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

    // Only the cleaner who holds the job may confirm it, and only while it is still live. Writing
    // conditionally (and only when not already confirmed) makes a double-tap harmless.
    const updated = await db
      .update(bookings)
      .set({ availabilityConfirmedAt: new Date() })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.providerId, provider.id),
          isNull(bookings.availabilityConfirmedAt),
        ),
      )
      .returning({ id: bookings.id, status: bookings.status })

    if (updated.length === 0) {
      // Either already confirmed (fine — say so rather than erroring) or not their booking.
      const [existing] = await db
        .select({ confirmedAt: bookings.availabilityConfirmedAt })
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)))
      if (existing?.confirmedAt) return NextResponse.json({ success: true, alreadyConfirmed: true })
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (!ACTIVE.includes(updated[0].status as (typeof ACTIVE)[number])) {
      return NextResponse.json({ error: "This booking is no longer active." }, { status: 422 })
    }

    // Confirming IS activity — stamping it stops the same cleaner being treated as silent on their
    // other jobs in the next few hours.
    void stampProviderLastActive(userId).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/confirm-availability POST]", err)
    void logError({
      message: "[bookings/[id]/confirm-availability POST]",
      error: err,
      route: "/api/bookings/[id]/confirm-availability",
      severity: "error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
