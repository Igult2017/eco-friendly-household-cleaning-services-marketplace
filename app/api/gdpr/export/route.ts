import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, bookings, reviews, disputes, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [
    [user],
    userBookings,
    userReviews,
    userDisputes,
    userNotifications,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select({ id: bookings.id, bookingNumber: bookings.bookingNumber, status: bookings.status, scheduledAt: bookings.scheduledAt, totalAmount: bookings.totalAmount, createdAt: bookings.createdAt })
      .from(bookings).where(eq(bookings.customerId, userId)),
    db.select({ id: reviews.id, overallRating: reviews.overallRating, title: reviews.title, body: reviews.body, createdAt: reviews.createdAt })
      .from(reviews).where(eq(reviews.customerId, userId)),
    db.select({ id: disputes.id, reason: disputes.reason, status: disputes.status, createdAt: disputes.createdAt })
      .from(disputes).where(eq(disputes.openedBy, userId)),
    db.select({ id: notifications.id, type: notifications.type, title: notifications.title, createdAt: notifications.createdAt })
      .from(notifications).where(eq(notifications.userId, userId)),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    subject: "GDPR Data Export — DORIX (Art. 20)",
    profile: user
      ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, gdprConsentAt: user.gdprConsentAt, marketingConsent: user.marketingConsent, createdAt: user.createdAt }
      : null,
    bookings: userBookings,
    reviews: userReviews,
    disputes: userDisputes,
    notifications: userNotifications,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="dorix-data-export-${userId}.json"`,
    },
  })
}
