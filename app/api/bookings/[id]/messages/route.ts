import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { notifications, messages } from "@/lib/db/schema"
import { eq, asc, and, ne } from "drizzle-orm"
import { pusherServer } from "@/lib/pusher/server"
import { logError } from "@/lib/utils/logError"

type RouteContext = { params: Promise<{ id: string }> }

async function getBookingAndVerifyAccess(bookingId: string, userId: string) {
  const booking = await db.query.bookings.findFirst({
    where: (b, { eq: eqFn }) => eqFn(b.id, bookingId),
  })
  if (!booking) return null

  const provider = await db.query.providers.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, booking.providerId),
  })

  const isCustomer = booking.customerId === userId
  const isProvider = provider?.userId === userId

  if (!isCustomer && !isProvider) return null

  return { booking, provider, isCustomer, isProvider }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: bookingId } = await params

    const access = await getBookingAndVerifyAccess(bookingId, userId)
    if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const thread = await db
      .select()
      .from(messages)
      .where(eq(messages.bookingId, bookingId))
      .orderBy(asc(messages.createdAt))

    // Mark all unread messages from the other party as read in a single query
    const hasUnread = thread.some((m) => !m.isRead && m.senderId !== userId)
    if (hasUnread) {
      await db
        .update(messages)
        .set({ isRead: true })
        .where(
          and(
            eq(messages.bookingId, bookingId),
            ne(messages.senderId, userId),
            eq(messages.isRead, false)
          )
        )
    }

    return NextResponse.json({ messages: thread })
  } catch (err) {
    console.error("[bookings/[id]/messages GET]", err)
    void logError({ message: "[bookings/[id]/messages GET]", error: err, route: "/api/bookings/[id]/messages", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const sendMessageSchema = z.object({
  body: z.string().min(1).max(2000),
})

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: bookingId } = await params

    const access = await getBookingAndVerifyAccess(bookingId, userId)
    if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { booking, provider, isCustomer } = access

    const parsed = sendMessageSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
    }

    const { body } = parsed.data

    const [newMessage] = await db
      .insert(messages)
      .values({ bookingId, senderId: userId, body })
      .returning()

    // Determine recipient — provider link uses the /provider/ prefix route
    const recipientId = isCustomer ? provider!.userId : booking.customerId
    const notifLink = isCustomer
      ? `/provider/bookings/${bookingId}/messages`
      : `/bookings/${bookingId}/messages`

    await db.insert(notifications).values({
      userId: recipientId,
      type: "new_message",
      title: "New message",
      body: body.slice(0, 100),
      link: notifLink,
      metadata: { message: body.slice(0, 100) },
    })

    // Trigger Pusher event — non-fatal if it fails
    try {
      await pusherServer.trigger(`private-booking-${bookingId}`, "new-message", {
        messageId: newMessage.id,
        senderId: userId,
        body,
        createdAt: newMessage.createdAt,
      })
    } catch (err) {
      console.error("[pusher] Failed to trigger new-message event:", err)
      void logError({ message: "[pusher] Failed to trigger new-message event:", error: err, route: "/api/bookings/[id]/messages", severity: "error" })
    }

    return NextResponse.json({ message: newMessage }, { status: 201 })
  } catch (err) {
    console.error("[bookings/[id]/messages POST]", err)
    void logError({ message: "[bookings/[id]/messages POST]", error: err, route: "/api/bookings/[id]/messages", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
