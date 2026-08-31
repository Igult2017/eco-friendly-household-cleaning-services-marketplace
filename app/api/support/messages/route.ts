import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { supportMessages, notifications, users, bookings, providers } from "@/lib/db/schema"
import { eq, and, asc, inArray } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { logError } from "@/lib/utils/logError"

// User side of the in-app support channel — one ongoing thread per user with the DORIXÉ team.
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const thread = await db.select().from(supportMessages).where(eq(supportMessages.userId, userId)).orderBy(asc(supportMessages.createdAt))

    if (thread.some((m) => m.fromAdmin && !m.isRead)) {
      await db
        .update(supportMessages)
        .set({ isRead: true })
        .where(and(eq(supportMessages.userId, userId), eq(supportMessages.fromAdmin, true), eq(supportMessages.isRead, false)))
    }
    // Clear the support-reply notifications so the bell/nav badges update.
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.type, "new_message"), eq(notifications.isRead, false), inArray(notifications.link, ["/support", "/provider/support"])))

    return NextResponse.json({ messages: thread })
  } catch (err) {
    console.error("[support/messages GET]", err)
    void logError({ message: "[support/messages GET]", error: err, route: "/api/support/messages", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const sendSchema = z.object({ body: z.string().min(1).max(4000), bookingId: z.string().uuid().optional() })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = sendSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    // Only attach a booking the caller is actually a party to — same ownership check /api/disputes
    // already uses, so this purely-informational context can't be spoofed to point at someone
    // else's job.
    let metadata: { bookingId?: string; bookingNumber?: string } | undefined
    if (parsed.data.bookingId) {
      const [b] = await db
        .select({ id: bookings.id, bookingNumber: bookings.bookingNumber, customerId: bookings.customerId, providerId: bookings.providerId })
        .from(bookings)
        .where(eq(bookings.id, parsed.data.bookingId))
      if (b) {
        let isParty = b.customerId === userId
        if (!isParty) {
          const [prov] = await db.select({ id: providers.id }).from(providers).where(and(eq(providers.userId, userId), eq(providers.id, b.providerId)))
          isParty = !!prov
        }
        if (isParty) metadata = { bookingId: b.id, bookingNumber: b.bookingNumber }
      }
    }

    // Throttle the admin email: only when there's no still-unread user message in this thread.
    const [pendingUnread] = await db
      .select({ id: supportMessages.id })
      .from(supportMessages)
      .where(and(eq(supportMessages.userId, userId), eq(supportMessages.fromAdmin, false), eq(supportMessages.isRead, false)))

    const [newMessage] = await db
      .insert(supportMessages)
      .values({ userId, senderId: userId, body: parsed.data.body, metadata })
      .returning()

    if (!pendingUnread && process.env.ADMIN_EMAIL) {
      try {
        const [u] = await db.select({ email: users.email, firstName: users.firstName, role: users.role }).from(users).where(eq(users.id, userId))
        await resend.emails.send({
          from: FROM,
          to: process.env.ADMIN_EMAIL,
          subject: `[Support] New message from ${u?.firstName ?? "a user"} (${u?.role ?? "user"})${metadata?.bookingNumber ? ` — ${metadata.bookingNumber}` : ""}`,
          html: `<p><strong>${u?.firstName ?? "User"}</strong> (${u?.email ?? userId}) wrote${metadata?.bookingNumber ? ` about booking <strong>${metadata.bookingNumber}</strong>` : ""}:</p><p>${parsed.data.body.slice(0, 500).replace(/</g, "&lt;")}</p><p>Reply in the admin panel → Support.</p>`,
        })
      } catch { /* best-effort */ }
    }

    return NextResponse.json({ message: newMessage }, { status: 201 })
  } catch (err) {
    console.error("[support/messages POST]", err)
    void logError({ message: "[support/messages POST]", error: err, route: "/api/support/messages", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
