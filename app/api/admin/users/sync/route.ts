import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { syncClerkUsers } from "@/lib/clerk/sync"
import { logError } from "@/lib/utils/logError"

async function requireAdmin(): Promise<string | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role === "admin") return userId
  // Fallback: Clerk API (handles fresh sessions where JWT hasn't refreshed yet)
  try {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    if ((user.publicMetadata as { role?: string })?.role === "admin") return userId
  } catch { /* Clerk unreachable — deny */ }
  return null
}

// POST /api/admin/users/sync — reconcile the users table against Clerk.
// Self-healing backstop for missed webhook deliveries.
export async function POST() {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await syncClerkUsers()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[admin/users/sync POST]", err)
    void logError({ message: "[admin/users/sync POST]", error: err, route: "/api/admin/users/sync", severity: "error" })
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
