import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

type AdminResult = { adminId: string } | NextResponse

export async function requireAdmin(): Promise<AdminResult> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // JWT carries role; may be stale for up to 60s after first set
  let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

  // Fallback: hit Clerk API directly when JWT hasn't refreshed yet
  if (!role) {
    try {
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)
      role = (user.publicMetadata as { role?: string })?.role
    } catch {
      // Clerk API unreachable — deny rather than accidentally grant access
    }
  }

  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return { adminId: userId }
}
