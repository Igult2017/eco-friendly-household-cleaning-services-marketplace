import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Soft delete — hard delete only after 30 days per data retention policy
    await db.update(users).set({
      deletedAt: new Date(),
      isActive: false,
      email: `deleted_${userId}@dorix.invalid`,
      firstName: "Deleted",
      lastName: "User",
      phone: null,
    }).where(eq(users.id, userId))

    // Ban the user in Clerk — revokes all active sessions immediately
    const clerk = await clerkClient()
    await clerk.users.banUser(userId)

    return NextResponse.json({ success: true, message: "Account scheduled for deletion. You will be signed out." })
  } catch (err) {
    console.error("[gdpr/delete POST]", err)
    void logError({ message: "[gdpr/delete POST]", error: err, route: "/api/gdpr/delete", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
