import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"

const VALID_ROLES = ["admin", "customer", "provider"] as const
type Role = (typeof VALID_ROLES)[number]

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!me || me.role !== "admin") return null
  return userId
}

// PATCH /api/admin/users/[id] — change a user's role
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { role } = await req.json() as { role: Role }

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
  await db.update(users).set({ role }).where(eq(users.id, id))

  return NextResponse.json({ success: true, role })
}

// DELETE /api/admin/users/[id] — delete a user (including self)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  await db.delete(users).where(eq(users.id, id))

  return NextResponse.json({ success: true, self: isSelf })
}
