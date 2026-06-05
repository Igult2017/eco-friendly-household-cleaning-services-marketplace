import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Soft delete — hard delete only after 30 days per data retention policy
  await db.update(users).set({
    deletedAt: new Date(),
    email: `deleted_${userId}@dorix.invalid`,
    firstName: "Deleted",
    lastName: "User",
    phone: null,
  }).where(eq(users.id, userId))

  return NextResponse.json({ success: true, message: "Account scheduled for deletion. You will be signed out." })
}
