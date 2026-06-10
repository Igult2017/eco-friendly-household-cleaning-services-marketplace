import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, users } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"

export async function GET(req: Request) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? "pending"

    let whereClause
    if (status === "pending") {
      whereClause = and(eq(providers.isApproved, false), eq(providers.isSuspended, false))
    } else if (status === "approved") {
      whereClause = and(eq(providers.isApproved, true), eq(providers.isSuspended, false))
    } else if (status === "suspended") {
      whereClause = eq(providers.isSuspended, true)
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = 50
    const offset = (page - 1) * limit

    const rows = await db
      .select({
        id: providers.id,
        businessName: providers.businessName,
        bio: providers.bio,
        city: providers.city,
        postalCode: providers.postalCode,
        country: providers.country,
        ecoLevel: providers.ecoLevel,
        verificationStatus: providers.verificationStatus,
        stripeAccountStatus: providers.stripeAccountStatus,
        isApproved: providers.isApproved,
        isSuspended: providers.isSuspended,
        averageRating: providers.averageRating,
        totalReviews: providers.totalReviews,
        totalJobsCompleted: providers.totalJobsCompleted,
        profilePhotoUrl: providers.profilePhotoUrl,
        createdAt: providers.createdAt,
        userId: providers.userId,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(providers)
      .leftJoin(users, eq(providers.userId, users.id))
      .where(whereClause)
      .orderBy(desc(providers.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({ providers: rows, page, limit, hasMore: rows.length === limit })
  } catch (err) {
    console.error("[admin/providers GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
