import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { supportMessages, notifications, users } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { pusherServer } from "@/lib/pusher/server"
import { resend, FROM } from "@/lib/resend/client"
import { newMessageEmail } from "@/lib/resend/transactionalEmails"
import { logError } from "@/lib/utils/logError"

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const { userId } = await params

    const thread = await db.select().from(supportMessages).where(eq(supportMessages.userId, userId)).orderBy(asc(supportMessages.createdAt))
    if (thread.some((m) => !m.fromAdmin && !m.isRead)) {
      await db
        .update(supportMessages)
        .set({ isRead: true })
        .where(and(eq(supportMessages.userId, userId), eq(supportMessages.fromAdmin, false), eq(supportMessages.isRead, false)))
    }
    return NextResponse.json({ messages: thread })
  } catch (err) {
    console.error("[admin/support/[userId] GET]", err)
    void logError({ message: "[admin/support/[userId] GET]", error: err, route: "/api/admin/support/[userId]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const replySchema = z.object({ body: z.string().min(1).max(4000) })

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const { userId: adminId } = await auth()
    const { userId } = await params

    const parsed = replySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const [target] = await db.select({ email: users.email, locale: users.locale, role: users.role }).from(users).where(eq(users.id, userId))
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const [newMessage] = await db
      .insert(supportMessages)
      .values({ userId, senderId: adminId ?? "admin", fromAdmin: true, body: parsed.data.body })
      .returning()

    const link = target.role === "provider" ? "/provider/support" : "/support"
    const snippet = parsed.data.body.slice(0, 100)
    await db.insert(notifications).values({
      userId,
      type: "new_message",
      title: "Support replied",
      body: snippet,
      link,
      metadata: { variant: "support_reply", message: snippet },
    })
    try {
      await pusherServer.trigger(`private-customer-${userId}`, "new-message", { messageId: newMessage.id, body: parsed.data.body })
    } catch { /* non-fatal */ }
    // Support replies are solicited — always email.
    try {
      if (target.email) {
        const { subject, html } = newMessageEmail(target.locale, { title: "DORIXÉ Support", snippet })
        await resend.emails.send({ from: FROM, to: target.email, subject, html })
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ message: newMessage }, { status: 201 })
  } catch (err) {
    console.error("[admin/support/[userId] POST]", err)
    void logError({ message: "[admin/support/[userId] POST]", error: err, route: "/api/admin/support/[userId]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
