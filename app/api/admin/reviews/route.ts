import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reviews, users, providers } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  try {
    const { sessionClaims } = await auth()
    if ((sessionClaims?.metadata as { role?: string } | undefined)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
