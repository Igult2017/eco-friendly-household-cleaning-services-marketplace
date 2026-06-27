import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, bookings, reviews, disputes, notifications, providers, providerServices, ecoCertifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [
      [user],
      userBookings,
      userReviews,
      userDisputes,
      userNotifications,
      [providerProfile],
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
      db.select({ id: providers.id, businessName: providers.businessName, bio: providers.bio, city: providers.city, ecoLevel: providers.ecoLevel, verificationStatus: providers.verificationStatus, stripeAccountStatus: providers.stripeAccountStatus, averageRating: providers.averageRating, totalReviews: providers.totalReviews, createdAt: providers.createdAt })
        .from(providers).where(eq(providers.userId, userId)),
    ])

    let providerData = null
    if (providerProfile) {
      // BUG-016: a user who is also a provider must get their provider-side bookings
      // in the Art. 20 export, not only the bookings they made as a customer.
      const [provServices, certifications, providerBookings] = await Promise.all([
        db.select({ id: providerServices.id, name: providerServices.name, basePrice: providerServices.basePrice, isActive: providerServices.isActive })
          .from(providerServices).where(eq(providerServices.providerId, providerProfile.id)),
        db.select({ id: ecoCertifications.id, name: ecoCertifications.name, issuingBody: ecoCertifications.issuingBody, verifiedAt: ecoCertifications.verifiedAt })
          .from(ecoCertifications).where(eq(ecoCertifications.providerId, providerProfile.id)),
        db.select({ id: bookings.id, bookingNumber: bookings.bookingNumber, status: bookings.status, scheduledAt: bookings.scheduledAt, totalAmount: bookings.totalAmount, providerPayout: bookings.providerPayout, createdAt: bookings.createdAt })
          .from(bookings).where(eq(bookings.providerId, providerProfile.id)),
      ])
      providerData = { ...providerProfile, services: provServices, certifications, bookingsAsProvider: providerBookings }
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      subject: "GDPR Data Export — DORIXÉ (Art. 20)",
      profile: user
        ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, gdprConsentAt: user.gdprConsentAt, marketingConsent: user.marketingConsent, createdAt: user.createdAt }
        : null,
      providerProfile: providerData,
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
  } catch (err) {
    console.error("[gdpr/export GET]", err)
    void logError({ message: "[gdpr/export GET]", error: err, route: "/api/gdpr/export", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
