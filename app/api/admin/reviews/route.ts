import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { db } from "@/lib/db"
import { reviews, users, providers } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const rows = await db
      .select({
        id: reviews.id,
        overallRating: reviews.overallRating,
        title: reviews.title,
        body: reviews.body,
        isFlagged: reviews.isFlagged,
        adminNote: reviews.adminNote,
        isPublic: reviews.isPublic,
        createdAt: reviews.createdAt,
        providerBusinessName: providers.businessName,
        customerEmail: users.email,
        customerFirstName: users.firstName,
      })
      .from(reviews)
      .leftJoin(providers, eq(reviews.providerId, providers.id))
      .leftJoin(users, eq(reviews.customerId, users.id))
      .orderBy(desc(reviews.createdAt))
      .limit(100)

    return NextResponse.json({ reviews: rows })
  } catch (err) {
    console.error("[admin/reviews GET]", err)
    void logError({ message: "[admin/reviews GET]", error: err, route: "/api/admin/reviews", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
