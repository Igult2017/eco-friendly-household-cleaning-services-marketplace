import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, bookings, customerReviews } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const schema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).optional(),
})

// Provider rates the customer for a completed booking (two-way reviews).
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db.select({ id: providers.id }).from(providers).where(and(eq(providers.userId, userId), eq(providers.isSuspended, false)))
    if (!provider) return NextResponse.json({ error: "Not a provider or account suspended" }, { status: 403 })

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { bookingId, rating, body } = parsed.data

    const [booking] = await db
      .select({ providerId: bookings.providerId, customerId: bookings.customerId, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
    if (!booking || booking.providerId !== provider.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    // The work is done once the provider has marked it complete (status flips to
    // pending_capture, then completed after Stripe capture).
    if (booking.status !== "completed" && booking.status !== "pending_capture") {
      return NextResponse.json({ error: "You can only review completed bookings" }, { status: 422 })
    }

    const [existing] = await db.select({ id: customerReviews.id }).from(customerReviews).where(eq(customerReviews.bookingId, bookingId))
    if (existing) return NextResponse.json({ error: "You've already reviewed this booking" }, { status: 409 })

    await db.insert(customerReviews).values({
      bookingId,
      providerId: provider.id,
      customerId: booking.customerId,
      rating,
      body: body?.trim() || null,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error("[provider/customer-review POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
