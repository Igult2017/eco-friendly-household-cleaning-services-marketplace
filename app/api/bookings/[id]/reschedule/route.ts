import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, notifications, providerAvailability, providers } from "@/lib/db/schema"
import { eq, and, inArray, gte, lte, ne } from "drizzle-orm"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"

const rescheduleSchema = z.object({
  newScheduledAt: z.string().datetime(),
  newScheduledEndAt: z.string().datetime(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: bookingId } = await params

    const [booking] = await db
      .select({
        id: bookings.id,
        customerId: bookings.customerId,
        providerId: bookings.providerId,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, userId)))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    if (!["payment_authorized", "confirmed"].includes(booking.status)) {
      return NextResponse.json({ error: "Booking cannot be rescheduled in its current status" }, { status: 422 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = rescheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 422 })
    }

    const { newScheduledAt, newScheduledEndAt } = parsed.data
    const newStart = new Date(newScheduledAt)
    const newEnd = new Date(newScheduledEndAt)

    if (newStart <= new Date()) {
      return NextResponse.json({ error: "New scheduled time must be in the future" }, { status: 422 })
    }

    // Check provider availability for the day of week
    const dayOfWeek = newStart.getDay()
    const [availability] = await db
      .select({ id: providerAvailability.id, startTime: providerAvailability.startTime, endTime: providerAvailability.endTime })
      .from(providerAvailability)
      .where(
        and(
          eq(providerAvailability.providerId, booking.providerId),
          eq(providerAvailability.dayOfWeek, dayOfWeek),
          eq(providerAvailability.isActive, true)
        )
      )

    if (!availability) {
      return NextResponse.json({ error: "Provider is not available on that day" }, { status: 409 })
    }

    // Verify the requested time falls within the provider's working hours
    const reqH = newStart.getUTCHours()
    const reqM = newStart.getUTCMinutes()
    const reqTime = String(reqH).padStart(2, "0") + ":" + String(reqM).padStart(2, "0")
    if (reqTime < availability.startTime || reqTime >= availability.endTime) {
      return NextResponse.json(
        { error: "Requested time is outside the provider's working hours" },
        { status: 422 }
      )
    }

    // Check for conflicting bookings at the new time (exclude this booking)
    const activeStatuses = ["payment_authorized", "confirmed", "in_progress", "pending_capture"] as const
    const conflictingBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.providerId, booking.providerId),
          inArray(bookings.status, [...activeStatuses]),
          ne(bookings.id, bookingId),
          lte(bookings.scheduledAt, newEnd),
          gte(bookings.scheduledEndAt, newStart)
        )
      )

    if (conflictingBookings.length > 0) {
      return NextResponse.json({ error: "Provider not available at requested time" }, { status: 409 })
    }

    // Update the booking — catch unique constraint violation (concurrent reschedule to same slot)
    try {
      await db
        .update(bookings)
        .set({ scheduledAt: newStart, scheduledEndAt: newEnd, updatedAt: new Date() })
        .where(eq(bookings.id, bookingId))
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string }
      if (pgErr?.code === "23505" || pgErr?.message?.includes("duplicate")) {
        return NextResponse.json(
          { error: "That time slot was just taken by another booking. Please choose a different time." },
          { status: 409 }
        )
      }
      throw err
    }

    // Fetch provider's Clerk userId for notification
    const [provider] = await db
      .select({ userId: providers.userId })
      .from(providers)
      .where(eq(providers.id, booking.providerId))

    // BUG-015: pin the market timezone so a near-midnight slot doesn't render the
    // wrong calendar day/time on a UTC server.
    const formattedDate = newStart.toLocaleDateString("en-GB", {
      timeZone: "Europe/Berlin",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    // Notify provider
    if (provider) {
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "booking_rescheduled",
        title: "Booking rescheduled",
        body: `A booking has been rescheduled to ${formattedDate}.`,
        link: "/provider/bookings",
      })
    }

    // Notify customer — BUG-012: was "booking_confirmed" (wrong icon + could re-trigger
    // payment-confirmation UI); a reschedule is its own notification type.
    await db.insert(notifications).values({
      userId: booking.customerId,
      type: "booking_rescheduled",
      title: "Booking rescheduled",
      body: "Your booking has been rescheduled.",
      link: `/bookings/${bookingId}`,
    })

    return NextResponse.json({ success: true, scheduledAt: newScheduledAt })
  } catch (err) {
    console.error("[bookings/[id]/reschedule POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
