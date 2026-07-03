import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts, users, bids } from "@/lib/db/schema"
import { eq, desc, count, sql } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { logError } from "@/lib/utils/logError"

// Admin job-board overview: every job post with owner + bid count, newest first.
export async function GET() {
  try {
    const gate = await requireAdmin()
    if (gate instanceof NextResponse) return gate

    const rows = await db
      .select({
        id: jobPosts.id,
        title: jobPosts.title,
        status: jobPosts.status,
        createdAt: jobPosts.createdAt,
        desiredDate: jobPosts.desiredDate,
        budgetMin: jobPosts.budgetMin,
        serviceAddress: jobPosts.serviceAddress,
        customerId: jobPosts.customerId,
        customerName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
        customerEmail: users.email,
        bidCount: count(bids.id),
      })
      .from(jobPosts)
      .leftJoin(users, eq(jobPosts.customerId, users.id))
      .leftJoin(bids, eq(bids.jobPostId, jobPosts.id))
      .groupBy(jobPosts.id, users.firstName, users.lastName, users.email)
      .orderBy(desc(jobPosts.createdAt))
      .limit(200)

    return NextResponse.json({ jobs: rows })
  } catch (err) {
    console.error("[admin/jobs GET]", err)
    void logError({ message: "[admin/jobs GET]", error: err, route: "/api/admin/jobs", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
