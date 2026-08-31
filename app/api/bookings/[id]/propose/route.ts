import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, providers, notifications } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"
import { getMinHourlyRateCents } from "@/lib/platform/settings"

const schema = z
  .object({
    scheduledAt: z.string().datetime().refine((v) => new Date(v) > new Date(), { message: "must be in the future" }).optional(),
    durationMinutes: z.number().int().min(30).max(480).optional(),
    // .min(100) is only a basic sanity floor — zod can't read the admin-configurable minimum
    // (lib/platform/settings.ts getMinHourlyRateCents) inline, so that's checked separately below.
    hourlyCents: z.number().int().min(100).max(100_000).optional(),
    message: z.string().max(500).optional(),
  })
  .refine((d) => d.scheduledAt || d.hourlyCents, { message: "propose a new time and/or a new hourly rate" })
  // A reason is required specifically when a new date/time is being proposed.
  .refine((d) => !d.scheduledAt || (d.message && d.message.trim().length >= 5), {
    message: "a reason is required when proposing a new time", path: ["message"],
  })

// Either party proposes a change — a client can only ever propose a new date/time (they don't set
// the cleaner's price), a cleaner can also counter-offer the rate. Nothing changes until the OTHER
// party accepts (proposal-response route) — the original hold stays untouched.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id: bookingId } = await params

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [b] = await db
      .select({ id: bookings.id, customerId: bookings.customerId, providerId: bookings.providerId, scheduledAt: bookings.scheduledAt })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ["payment_authorized", "confirmed"])))
    if (!b) return NextResponse.json({ error: "Booking not found or not open for changes" }, { status: 404 })

    const [prov] = await db.select({ id: providers.id, userId: providers.userId }).from(providers).where(eq(providers.id, b.providerId))

    let proposedBy: "client" | "provider"
    if (b.customerId === userId) {
      proposedBy = "client"
      if (parsed.data.hourlyCents !== undefined) {
        return NextResponse.json({ error: { fieldErrors: { hourlyCents: ["Only the cleaner can propose a new rate."] } } }, { status: 403 })
      }
    } else if (prov?.userId === userId) {
      proposedBy = "provider"
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (parsed.data.hourlyCents !== undefined) {
      const minHourlyRateCents = await getMinHourlyRateCents()
      if (parsed.data.hourlyCents < minHourlyRateCents) {
        return NextResponse.json(
          { error: { fieldErrors: { hourlyCents: [`Hourly rate must be at least ${(minHourlyRateCents / 100).toFixed(2)} per hour.`] } } },
          { status: 422 },
        )
      }
    }

    await db
      .update(bookings)
      .set({ pendingProposal: { ...parsed.data, proposedAt: new Date().toISOString(), proposedBy }, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))

    // Notify whichever party did NOT propose.
    if (proposedBy === "provider") {
      await db.insert(notifications).values({
        userId: b.customerId,
        type: "booking_rescheduled",
        title: "Your cleaner suggests changes",
        body: "Your cleaner suggested changes to your booking. Review and accept or decline.",
        link: `/bookings/${bookingId}`,
        metadata: { variant: "booking_proposal" },
      })
    } else if (prov) {
      await db.insert(notifications).values({
        userId: prov.userId,
        type: "booking_rescheduled",
        title: "Your client suggests a new time",
        body: "Your client suggested a new date/time for this booking. Review and accept or decline.",
        link: "/provider/bookings",
        metadata: { variant: "booking_proposal" },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/propose POST]", err)
    void logError({ message: "[bookings/[id]/propose POST]", error: err, route: "/api/bookings/[id]/propose", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
