import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, providers, providerServices, users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const rows = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      scheduledEndAt: bookings.scheduledEndAt,
      serviceAddress: bookings.serviceAddress,
      specialInstructions: bookings.specialInstructions,
      subtotalAmount: bookings.subtotalAmount,
      providerPayout: bookings.providerPayout,
      carbonOffsetAmount: bookings.carbonOffsetAmount,
      completionPhotoUrls: bookings.completionPhotoUrls,
      createdAt: bookings.createdAt,
      customerName: users.firstName,
      customerEmail: users.email,
      serviceName: providerServices.name,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.customerId, users.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .where(eq(bookings.providerId, provider.id))
    .orderBy(desc(bookings.scheduledAt))
    .limit(100)

  const filtered = status ? rows.filter((r) => r.status === status) : rows

  return NextResponse.json({ bookings: filtered })
}
