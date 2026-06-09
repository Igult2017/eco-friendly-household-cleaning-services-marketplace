import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, users } from "@/lib/db/schema"
import { bookingRatelimit } from "@/lib/redis/client"
import { createBookingSchema } from "@/lib/validations/booking"
import { desc, eq } from "drizzle-orm"
import { createBooking, BookingError } from "@/lib/bookings/create"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await bookingRatelimit.limit(userId)
  if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  // Only customers may create bookings
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (user?.role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const result = await createBooking(userId, parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}

export async function GET(_req: Request) {
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
}
