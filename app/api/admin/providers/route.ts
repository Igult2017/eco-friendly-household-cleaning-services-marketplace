import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, users } from "@/lib/db/schema"
import { eq, and, desc, like } from "drizzle-orm"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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
      city: providers.city,
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
}
