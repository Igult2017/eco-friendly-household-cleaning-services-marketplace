import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerAvailability, providerBlackoutDates, bookings } from "@/lib/db/schema"
import { eq, and, gte, lte, inArray } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get("date")

    if (!dateStr) {
      return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 })
    }

    // Bug 5: parse as explicit UTC midnight so .getUTCDay() is always correct regardless of server timezone
    const date = new Date(dateStr + "T00:00:00Z")
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }

    const [provider] = await db
      .select({ id: providers.id, timezone: providers.timezone })
      .from(providers)
      .where(and(eq(providers.id, id), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Bug 5: use getUTCDay() so the day number matches the YYYY-MM-DD input, not the server's local timezone
    const dayOfWeek = date.getUTCDay() // 0=Sunday, unambiguous for any UTC offset

    // Check availability for that day
    const [availability] = await db
      .select()
      .from(providerAvailability)
      .where(and(eq(providerAvailability.providerId, id), eq(providerAvailability.dayOfWeek, dayOfWeek), eq(providerAvailability.isActive, true)))

    // Check blackout dates — use the original dateStr directly (already YYYY-MM-DD)
    const [blackout] = await db
      .select({ id: providerBlackoutDates.id })
      .from(providerBlackoutDates)
      .where(and(eq(providerBlackoutDates.providerId, id), eq(providerBlackoutDates.date, dateStr)))

    if (blackout || !availability) {
      return NextResponse.json({ available: false, reason: blackout ? "blackout" : "no_schedule" })
    }

    // Existing bookings around that day. Pad ±1 day: the UTC day-window missed bookings whose LOCAL
    // day (negative-offset cleaners, e.g. US Pacific evenings) lands on the neighbouring UTC day —
    // the conflicting slot then wasn't greyed. Overfetch is harmless; greying compares exact instants.
    const dayStart = new Date(new Date(dateStr + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000)
    const dayEnd = new Date(new Date(dateStr + "T23:59:59.999Z").getTime() + 24 * 60 * 60 * 1000)

    // Bug 4: only count active bookings — cancelled/disputed/refunded must not block time slots
    const existingBookings = await db
      .select({ scheduledAt: bookings.scheduledAt, scheduledEndAt: bookings.scheduledEndAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.providerId, id),
          inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture"]),
          gte(bookings.scheduledAt, dayStart),
          lte(bookings.scheduledAt, dayEnd),
        )
      )

    return NextResponse.json({
      available: true,
      // The cleaner's timezone — the client picks slots in this frame, so the booking time must be
      // built in it (not the client's browser tz).
      timezone: provider.timezone ?? "Europe/Berlin",
      workingHours: {
        start: availability.startTime,
        end: availability.endTime,
      },
      bookedSlots: existingBookings.map((b) => ({
        start: b.scheduledAt,
        end: b.scheduledEndAt,
      })),
    })
  } catch (err) {
    console.error("[providers/[id]/availability GET]", err)
    void logError({ message: "[providers/[id]/availability GET]", error: err, route: "/api/providers/[id]/availability", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
