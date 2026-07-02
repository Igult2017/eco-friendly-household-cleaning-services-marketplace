import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { jobPosts, bids, providers, messages, notifications } from "@/lib/db/schema"
import { eq, and, asc, ne } from "drizzle-orm"
import { pusherServer } from "@/lib/pusher/server"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

type RouteContext = { params: Promise<{ id: string }> }

// Job-level chat: opens between the client and the ACCEPTED cleaner the moment a bid is accepted —
// so they can coordinate details before payment creates the booking (and it stays usable after).
async function verifyAccess(jobPostId: string, userId: string) {
  const [job] = await db
    .select({ id: jobPosts.id, customerId: jobPosts.customerId, acceptedBidId: jobPosts.acceptedBidId })
    .from(jobPosts)
    .where(eq(jobPosts.id, jobPostId))
  if (!job?.acceptedBidId) return null // chat exists only once a bid is accepted

  const [winner] = await db
    .select({ providerUserId: providers.userId })
    .from(bids)
    .innerJoin(providers, eq(bids.providerId, providers.id))
    .where(eq(bids.id, job.acceptedBidId))
  if (!winner) return null

  const isCustomer = job.customerId === userId
  const isProvider = winner.providerUserId === userId
  if (!isCustomer && !isProvider) return null
  return { job, providerUserId: winner.providerUserId, isCustomer }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const access = await verifyAccess(id, userId)
    if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const thread = await db.select().from(messages).where(eq(messages.jobPostId, id)).orderBy(asc(messages.createdAt))

    if (thread.some((m) => !m.isRead && m.senderId !== userId)) {
      await db
        .update(messages)
        .set({ isRead: true })
        .where(and(eq(messages.jobPostId, id), ne(messages.senderId, userId), eq(messages.isRead, false)))
    }
    // Clear this thread's new_message notifications so the bell badge updates.
    const viewerLink = access.isCustomer ? "/jobs" : "/provider/jobs"
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.type, "new_message"), eq(notifications.isRead, false), eq(notifications.link, viewerLink)))

    return NextResponse.json({ messages: thread })
  } catch (err) {
    console.error("[jobs/[id]/messages GET]", err)
    void logError({ message: "[jobs/[id]/messages GET]", error: err, route: "/api/jobs/[id]/messages", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const sendSchema = z.object({ body: z.string().min(1).max(2000) })

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const access = await verifyAccess(id, userId)
    if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const parsed = sendSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const [newMessage] = await db
      .insert(messages)
      .values({ jobPostId: id, senderId: userId, body: parsed.data.body })
      .returning()

    const recipientId = access.isCustomer ? access.providerUserId : access.job.customerId
    await db.insert(notifications).values({
      userId: recipientId,
      type: "new_message",
      title: "New message",
      body: parsed.data.body.slice(0, 100),
      link: access.isCustomer ? "/provider/jobs" : "/jobs",
      metadata: { message: parsed.data.body.slice(0, 100) },
    })

    try {
      await pusherServer.trigger(`private-job-${id}`, "new-message", {
        messageId: newMessage.id, senderId: userId, body: parsed.data.body, createdAt: newMessage.createdAt,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ message: newMessage }, { status: 201 })
  } catch (err) {
    console.error("[jobs/[id]/messages POST]", err)
    void logError({ message: "[jobs/[id]/messages POST]", error: err, route: "/api/jobs/[id]/messages", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
