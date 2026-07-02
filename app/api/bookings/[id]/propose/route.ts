import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, providers, notifications } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

const schema = z
  .object({
    scheduledAt: z.string().datetime().refine((v) => new Date(v) > new Date(), { message: "must be in the future" }).optional(),
    durationMinutes: z.number().int().min(30).max(480).optional(),
    hourlyCents: z.number().int().min(100).max(100_000).optional(),
    message: z.string().max(500).optional(),
  })
  .refine((d) => d.scheduledAt || d.hourlyCents, { message: "propose a new time and/or a new hourly rate" })

// Cleaner counter-offers on a fresh booking: a different time and/or hourly rate. Nothing changes
// until the CLIENT accepts (proposal-response route) — the original hold stays untouched.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id: bookingId } = await params

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [prov] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!prov) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const [b] = await db
      .select({ id: bookings.id, customerId: bookings.customerId, scheduledAt: bookings.scheduledAt })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, prov.id), inArray(bookings.status, ["payment_authorized", "confirmed"])))
    if (!b) return NextResponse.json({ error: "Booking not found or not open for changes" }, { status: 404 })

    await db
      .update(bookings)
      .set({ pendingProposal: { ...parsed.data, proposedAt: new Date().toISOString() }, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))

    await db.insert(notifications).values({
      userId: b.customerId,
      type: "booking_rescheduled",
      title: "Your cleaner suggests changes",
      body: "Your cleaner suggested changes to your booking. Review and accept or decline.",
      link: `/bookings/${bookingId}`,
      metadata: { variant: "booking_proposal" },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/propose POST]", err)
    void logError({ message: "[bookings/[id]/propose POST]", error: err, route: "/api/bookings/[id]/propose", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
