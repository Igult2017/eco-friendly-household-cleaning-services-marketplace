import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { payments, bookings, providerServices, providers } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await db
      .select({
        id: payments.id,
        status: payments.status,
        amount: payments.amount,
        capturedAmount: payments.capturedAmount,
        refundedAmount: payments.refundedAmount,
        currency: payments.currency,
        capturedAt: payments.capturedAt,
        createdAt: payments.createdAt,
        bookingNumber: bookings.bookingNumber,
        bookingStatus: bookings.status,
        scheduledAt: bookings.scheduledAt,
        carbonOffsetAmount: bookings.carbonOffsetAmount,
        serviceName: providerServices.name,
        providerName: providers.businessName,
      })
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id))
      .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
      .leftJoin(providers, eq(bookings.providerId, providers.id))
      .where(eq(payments.customerId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(50)

    return NextResponse.json({ payments: rows })
  } catch (err) {
    console.error("[customer/payments GET]", err)
    void logError({ message: "[customer/payments GET]", error: err, route: "/api/customer/payments", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
