import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { disputes, bookings, users } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"

export async function GET(req: Request) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? "open"

    const rows = await db
      .select({
        id: disputes.id,
        bookingId: disputes.bookingId,
        status: disputes.status,
        reason: disputes.reason,
        description: disputes.description,
        resolutionAmount: disputes.resolutionAmount,
        createdAt: disputes.createdAt,
        resolvedAt: disputes.resolvedAt,
        bookingNumber: bookings.bookingNumber,
        totalAmount: bookings.totalAmount,
        openerEmail: users.email,
        openerFirstName: users.firstName,
        openerLastName: users.lastName,
      })
      .from(disputes)
      .leftJoin(bookings, eq(disputes.bookingId, bookings.id))
      .leftJoin(users, eq(disputes.openedBy, users.id))
      .where(status === "all" ? undefined : sql`${disputes.status} = ${status}`)
      .orderBy(desc(disputes.createdAt))
      .limit(100)

    return NextResponse.json({ disputes: rows })
  } catch (err) {
    console.error("[admin/disputes GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
