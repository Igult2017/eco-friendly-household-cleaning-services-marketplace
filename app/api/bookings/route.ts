import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, users } from "@/lib/db/schema"
import { bookingRatelimit } from "@/lib/redis/client"
import { createBookingSchema } from "@/lib/validations/booking"
import { desc, eq } from "drizzle-orm"
import { createBooking, BookingError } from "@/lib/bookings/create"
import { createUnpaidBooking } from "@/lib/bookings/createUnpaid"
import { logError } from "@/lib/utils/logError"

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const { success } = await bookingRatelimit.limit(userId)
      if (!success) return NextResponse.json({ error: "Rate limit exceeded. You can create up to 10 bookings per minute." }, { status: 429 })
    } catch (redisErr) {
      console.warn("[bookings POST] Redis rate limit unavailable, allowing through:", redisErr)
    }

    // JWT claims are authoritative; fall back to DB when JWT hasn't refreshed yet.
    const jwtRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role
    let role = jwtRole
    if (!role) {
      const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
      role = dbUser?.role ?? "customer"
    }
    if (role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const parsed = createBookingSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    try {
      // No paymentIntentId = the client chose to book without adding a card (cleaner gets warned).
      const result = parsed.data.paymentIntentId
        ? await createBooking(userId, parsed.data)
        : await createUnpaidBooking(userId, parsed.data)
      return NextResponse.json(result, { status: 201 })
    } catch (err) {
      if (err instanceof BookingError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }
  } catch (err) {
    console.error("[bookings POST]", err)
    void logError({ message: "[bookings POST]", error: err, route: "/api/bookings", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(_req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const customerBookings = await db.query.bookings.findMany({
      where: (b, { eq: eqFn }) => eqFn(b.customerId, userId),
      with: {
        provider: { columns: { businessName: true, slug: true, profilePhotoUrl: true } },
        service: { columns: { name: true, basePrice: true } },
      },
      orderBy: [desc(bookings.createdAt)],
      limit: 50,
    })

    return NextResponse.json({ bookings: customerBookings })
  } catch (err) {
    console.error("[bookings GET]", err)
    void logError({ message: "[bookings GET]", error: err, route: "/api/bookings", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
