import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, and, desc, inArray } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"
import { getEffectiveRoleForDisplay } from "@/lib/auth/effectiveRole"
import { getNotificationAudience } from "@/lib/notifications/audience"

const PAGE_SIZE = 20

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const effectiveRole = await getEffectiveRoleForDisplay()

    // A dual-role account's cleaner and client notifications share one userId — fetch a wider
    // page than we need, filter to whichever view is currently active, then trim. Anyone whose
    // view isn't "customer" or "provider" (admin, affiliate) gets the unfiltered list, matching
    // how those roles bypass view-gating elsewhere in the app.
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE * 3)

    const scoped =
      effectiveRole === "customer" || effectiveRole === "provider"
        ? rows.filter((n) => getNotificationAudience(n.link) === effectiveRole)
        : rows

    return NextResponse.json({ notifications: scoped.slice(0, PAGE_SIZE) })
  } catch (err) {
    console.error("[notifications GET]", err)
    void logError({ message: "[notifications GET]", error: err, route: "/api/notifications", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, ids } = await req.json().catch(() => ({} as { id?: string; ids?: string[] }))
    if (!id && !Array.isArray(ids)) return NextResponse.json({ error: "id or ids required" }, { status: 400 })

    if (Array.isArray(ids)) {
      const clean = ids.filter((x): x is string => typeof x === "string").slice(0, 100)
      if (clean.length) {
        await db.update(notifications).set({ isRead: true }).where(and(inArray(notifications.id, clean), eq(notifications.userId, userId)))
      }
    } else if (id === "all") {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId))
    } else {
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id!), eq(notifications.userId, userId)))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications PATCH]", err)
    void logError({ message: "[notifications PATCH]", error: err, route: "/api/notifications", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
