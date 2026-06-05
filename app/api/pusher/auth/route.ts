import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { pusherServer } from "@/lib/pusher/server"
import { db } from "@/lib/db"
import { users, providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new NextResponse("Unauthorized", { status: 401 })

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id") ?? ""
  const channelName = params.get("channel_name") ?? ""

  // Validate the user has permission for the requested channel
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))

  let allowed = false

  if (channelName === `private-customer-${userId}`) {
    allowed = true
  } else if (channelName === "private-admin" && user?.role === "admin") {
    allowed = true
  } else if (channelName.startsWith("private-provider-")) {
    // Provider can only auth their own channel
    const providerId = channelName.replace("private-provider-", "")
    const [prov] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    allowed = prov?.id === providerId
  }

  if (!allowed) return new NextResponse("Forbidden", { status: 403 })

  const authResponse = pusherServer.authorizeChannel(socketId, channelName)
  return NextResponse.json(authResponse)
}
