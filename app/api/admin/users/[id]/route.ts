import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"

const VALID_ROLES = ["admin", "customer", "provider"] as const
type Role = (typeof VALID_ROLES)[number]

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

// PATCH /api/admin/users/[id] — change a user's role
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await req.json().catch(() => ({} as { role?: Role }))
    const role = (body as { role?: Role }).role as Role

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Prevent removing the last admin
    if (id === adminId && role !== "admin") {
      const [otherAdmin] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, adminId)))
        .limit(1)
      if (!otherAdmin) {
        return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 })
      }
    }

    const client = await clerkClient()
    await client.users.updateUser(id, { publicMetadata: { role } })
    try {
      await db.update(users).set({ role }).where(eq(users.id, id))
    } catch (dbErr) {
      // BUG-008a: Clerk role (the auth source of truth) already changed but the DB mirror
      // failed — log enough to reconcile the drift rather than failing silently.
      console.error(`[admin/users PATCH] Clerk role set to "${role}" for ${id} but DB update failed — reconcile:`, dbErr)
      throw dbErr
    }

    return NextResponse.json({ success: true, role })
  } catch (err) {
    console.error("[admin/users/[id] PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] — delete a user (including self)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const isSelf = id === adminId

    // Prevent deleting the last admin
    if (isSelf) {
      const [otherAdmin] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, adminId)))
        .limit(1)
      if (!otherAdmin) {
        return NextResponse.json({ error: "Cannot delete the last admin. Promote another user first." }, { status: 400 })
      }
    }

    const client = await clerkClient()
    await client.users.deleteUser(id)
    try {
      await db.delete(users).where(eq(users.id, id))
    } catch (dbErr) {
      // BUG-008b: user removed from Clerk but the DB delete failed (likely FK references) —
      // log the id so the orphaned row can be cleaned up manually.
      console.error(`[admin/users DELETE] user ${id} deleted from Clerk but DB delete failed — orphaned row:`, dbErr)
      throw dbErr
    }

    return NextResponse.json({ success: true, self: isSelf })
  } catch (err) {
    console.error("[admin/users/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
