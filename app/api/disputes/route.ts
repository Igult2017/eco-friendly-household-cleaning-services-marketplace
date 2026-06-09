import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { disputes, bookings, providers } from "@/lib/db/schema"
import type { NewDispute } from "@/lib/db/schema/disputes"
import { inngest } from "@/lib/inngest/client"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const openDisputeSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  evidenceUrls: z.array(z.string().url()).default([]),
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = openDisputeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { bookingId, reason, description, evidenceUrls } = parsed.data

  // Bug 6: only allow evidence files from our own R2 bucket — any external URL is an XSS vector
  const r2Base = process.env.R2_PUBLIC_URL
  if (evidenceUrls.length > 0) {
    if (!r2Base) return NextResponse.json({ error: "File storage not configured" }, { status: 500 })
    const invalid = evidenceUrls.filter((u) => !u.startsWith(r2Base))
    if (invalid.length > 0) return NextResponse.json({ error: "Invalid evidence file URLs" }, { status: 400 })
  }

  // Find booking — caller must be customer or the provider
  const [booking] = await db
    .select({ id: bookings.id, status: bookings.status, customerId: bookings.customerId, providerId: bookings.providerId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

  let isParty = booking.customerId === userId
  if (!isParty) {
    const [prov] = await db.select({ id: providers.id }).from(providers).where(and(eq(providers.userId, userId), eq(providers.id, booking.providerId)))
    isParty = !!prov
  }
  if (!isParty) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  if (!["payment_authorized", "confirmed", "in_progress", "pending_capture", "completed"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot open dispute for this booking" }, { status: 422 })
  }

  // Check for existing dispute
  const [existing] = await db.select({ id: disputes.id }).from(disputes).where(eq(disputes.bookingId, bookingId))
  if (existing) return NextResponse.json({ error: "A dispute already exists for this booking" }, { status: 409 })

  const insertData: NewDispute = {
    bookingId,
    openedBy: userId,
    status: "open",
    reason,
    description,
    evidenceUrls,
  }

  const [newDispute] = await db.insert(disputes).values(insertData).returning({ id: disputes.id })

  // Update booking status
  await db.update(bookings).set({ status: "disputed" }).where(eq(bookings.id, bookingId))

  await inngest.send({ name: "dispute/opened", data: { disputeId: newDispute.id, bookingId, openedBy: userId } })

  return NextResponse.json({ disputeId: newDispute.id }, { status: 201 })
}
