import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, users, providers } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"

export async function GET(req: Request) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const limit = 20
    const offset = (page - 1) * limit

    const rows = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
        totalAmount: bookings.totalAmount,
        subtotalAmount: bookings.subtotalAmount,
        platformFeeAmount: bookings.platformFeeAmount,
        createdAt: bookings.createdAt,
        customerFirstName: users.firstName,
        customerLastName: users.lastName,
        customerEmail: users.email,
        providerBusinessName: providers.businessName,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(providers, eq(bookings.providerId, providers.id))
      .where(status ? sql`${bookings.status} = ${status}` : undefined)
      .orderBy(desc(bookings.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({ bookings: rows, page, limit })
  } catch (err) {
    console.error("[admin/bookings GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
