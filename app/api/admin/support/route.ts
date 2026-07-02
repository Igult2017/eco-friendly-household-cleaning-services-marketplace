import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { supportMessages, users } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { logError } from "@/lib/utils/logError"

// Admin inbox: one row per user thread — latest message, unread-from-user count, who they are.
export async function GET() {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const rows = await db
      .select({
        userId: supportMessages.userId,
        body: supportMessages.body,
        fromAdmin: supportMessages.fromAdmin,
        isRead: supportMessages.isRead,
        createdAt: supportMessages.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      })
      .from(supportMessages)
      .leftJoin(users, eq(supportMessages.userId, users.id))
      .orderBy(desc(supportMessages.createdAt))
      .limit(800)

    type Thread = { userId: string; name: string; email: string | null; role: string | null; lastBody: string; lastAt: Date | string; unread: number }
    const map = new Map<string, Thread>()
    for (const m of rows) {
      let t = map.get(m.userId)
      if (!t) {
        t = {
          userId: m.userId,
          name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId,
          email: m.email,
          role: m.role,
          lastBody: m.body,
          lastAt: m.createdAt,
          unread: 0,
        }
        map.set(m.userId, t)
      }
      if (!m.fromAdmin && !m.isRead) t.unread++
    }
    return NextResponse.json({ threads: [...map.values()] })
  } catch (err) {
    console.error("[admin/support GET]", err)
    void logError({ message: "[admin/support GET]", error: err, route: "/api/admin/support", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
