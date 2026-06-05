import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerAvailability, providerBlackoutDates, bookings } from "@/lib/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date")

  if (!dateStr) {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 })
  }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  const [provider] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(and(eq(providers.id, id), eq(providers.isApproved, true), eq(providers.isSuspended, false)))

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  const dayOfWeek = date.getDay() // 0=Sunday
  const dateString = date.toISOString().split("T")[0]

  // Check availability for that day
  const [availability] = await db
    .select()
    .from(providerAvailability)
    .where(and(eq(providerAvailability.providerId, id), eq(providerAvailability.dayOfWeek, dayOfWeek), eq(providerAvailability.isActive, true)))

  // Check blackout dates
  const [blackout] = await db
    .select({ id: providerBlackoutDates.id })
    .from(providerBlackoutDates)
    .where(and(eq(providerBlackoutDates.providerId, id), eq(providerBlackoutDates.date, dateString)))

  if (blackout || !availability) {
    return NextResponse.json({ available: false, reason: blackout ? "blackout" : "no_schedule" })
  }

  // Count existing bookings that day
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const existingBookings = await db
    .select({ scheduledAt: bookings.scheduledAt, scheduledEndAt: bookings.scheduledEndAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.providerId, id),
        gte(bookings.scheduledAt, dayStart),
        lte(bookings.scheduledAt, dayEnd),
      )
    )

  return NextResponse.json({
    available: true,
    workingHours: {
      start: availability.startTime,
      end: availability.endTime,
    },
    bookedSlots: existingBookings.map((b) => ({
      start: b.scheduledAt,
      end: b.scheduledEndAt,
    })),
  })
}
