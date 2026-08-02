import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerAvailability, providerBlackoutDates, bookings } from "@/lib/db/schema"
import { eq, and, gte, lte, inArray } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

// Month-at-a-glance version of /api/providers/[id]/availability (which is single-date, used at the
// moment of picking a slot). This one answers "is this cleaner generally free or booked, and when" —
// for the public profile page and the wizard's schedule step — without N single-date round trips.
const MAX_RANGE_DAYS = 62 // ~2 calendar months of navigation, enough to answer "when are they free"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")
    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "from and to are required (YYYY-MM-DD)" }, { status: 400 })
    }

    const from = new Date(fromStr + "T00:00:00Z")
    const to = new Date(toStr + "T00:00:00Z")
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400 })
    }
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `Range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 })
    }

    const [provider] = await db
      .select({ id: providers.id, timezone: providers.timezone })
      .from(providers)
      .where(and(eq(providers.id, id), eq(providers.isApproved, true), eq(providers.isSuspended, false)))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const weekSlots = await db
      .select({ dayOfWeek: providerAvailability.dayOfWeek })
      .from(providerAvailability)
      .where(and(eq(providerAvailability.providerId, id), eq(providerAvailability.isActive, true)))
    const workingDays = new Set(weekSlots.map((s) => s.dayOfWeek))
    // Unrestricted cleaner (no configured week) → every day is offered, mirrors the single-date route.
    const hasConfiguredWeek = weekSlots.length > 0

    const blackouts = await db
      .select({ date: providerBlackoutDates.date })
      .from(providerBlackoutDates)
      .where(and(eq(providerBlackoutDates.providerId, id), gte(providerBlackoutDates.date, fromStr), lte(providerBlackoutDates.date, toStr)))
    const blackoutSet = new Set(blackouts.map((b) => b.date))

    // Pad ±1 day for the same cross-timezone reason as the single-date route.
    const padStart = new Date(from.getTime() - 86_400_000)
    const padEnd = new Date(to.getTime() + 86_400_000 + 86_399_999)
    const activeBookings = await db
      .select({ scheduledAt: bookings.scheduledAt })
      .from(bookings)
      .where(and(
        eq(bookings.providerId, id),
        inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture"]),
        gte(bookings.scheduledAt, padStart),
        lte(bookings.scheduledAt, padEnd),
      ))
    const bookedDateSet = new Set(
      activeBookings.map((b) => b.scheduledAt.toLocaleDateString("sv-SE", { timeZone: provider.timezone ?? "Europe/Berlin" }))
    )

    const days: { date: string; status: "available" | "booked" | "day_off" | "blackout" }[] = []
    for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
      const d = new Date(t)
      const dateStr = d.toISOString().split("T")[0]
      const dayOfWeek = d.getUTCDay()
      const status =
        blackoutSet.has(dateStr) ? "blackout" :
        hasConfiguredWeek && !workingDays.has(dayOfWeek) ? "day_off" :
        bookedDateSet.has(dateStr) ? "booked" :
        "available"
      days.push({ date: dateStr, status })
    }

    return NextResponse.json({ days, timezone: provider.timezone ?? "Europe/Berlin" })
  } catch (err) {
    console.error("[providers/[id]/availability-range GET]", err)
    void logError({ message: "[providers/[id]/availability-range GET]", error: err, route: "/api/providers/[id]/availability-range", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
