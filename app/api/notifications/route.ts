import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(20)

    return NextResponse.json({ notifications: rows })
  } catch (err) {
    console.error("[notifications GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await req.json().catch(() => ({} as { id?: string }))
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    if (id === "all") {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId))
    } else {
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
