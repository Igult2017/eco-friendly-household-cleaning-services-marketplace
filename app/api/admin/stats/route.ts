import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, disputes, payments, providers, users } from "@/lib/db/schema"
import { eq, and, count, sum, gte, sql } from "drizzle-orm"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
    if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      gmvResult,
      activeBookingsResult,
      openDisputesResult,
      pendingProvidersResult,
      totalCustomersResult,
      totalProvidersResult,
      recentBookingsByDay,
    ] = await Promise.all([
      // Total GMV from captured payments
      db.select({ total: sum(payments.capturedAmount) })
        .from(payments)
        .where(eq(payments.status, "captured")),

      // Active bookings (confirmed or in_progress)
      db.select({ count: count() })
        .from(bookings)
        .where(sql`${bookings.status} IN ('confirmed', 'in_progress', 'payment_authorized')`),

      // Open disputes
      db.select({ count: count() })
        .from(disputes)
        .where(sql`${disputes.status} IN ('open', 'under_review', 'escalated')`),

      // Providers pending approval
      db.select({ count: count() })
        .from(providers)
        .where(and(eq(providers.isApproved, false), eq(providers.isSuspended, false))),

      // Total customers
      db.select({ count: count() })
        .from(users)
        .where(eq(users.role, "customer")),

      // Total providers (approved)
      db.select({ count: count() })
        .from(providers)
        .where(eq(providers.isApproved, true)),

      // Bookings per day for last 30 days
      db.select({
        day: sql<string>`DATE(${bookings.createdAt})`,
        count: count(),
        gmv: sum(bookings.totalAmount),
      })
        .from(bookings)
        .where(gte(bookings.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${bookings.createdAt})`)
        .orderBy(sql`DATE(${bookings.createdAt})`),
    ])

    return NextResponse.json({
      gmv: Number(gmvResult[0]?.total ?? 0),
      activeBookings: Number(activeBookingsResult[0]?.count ?? 0),
      openDisputes: Number(openDisputesResult[0]?.count ?? 0),
      pendingProviders: Number(pendingProvidersResult[0]?.count ?? 0),
      totalCustomers: Number(totalCustomersResult[0]?.count ?? 0),
      totalProviders: Number(totalProvidersResult[0]?.count ?? 0),
      bookingsByDay: recentBookingsByDay,
    })
  } catch (err) {
    console.error("[admin/stats GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
