import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { pusherServer } from "@/lib/pusher/server"
import { db } from "@/lib/db"
import { providers, bookings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const body = await req.text()
    const params = new URLSearchParams(body)
    const socketId = params.get("socket_id") ?? ""
    const channelName = params.get("channel_name") ?? ""

    // Validate the user has permission for the requested channel
    let allowed = false

    if (channelName === `private-customer-${userId}`) {
      allowed = true
    } else if (channelName === "private-admin") {
      // Admin is a Clerk publicMetadata role, not the DB role.
      let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
      if (!role) {
        try {
          const clerk = await clerkClient()
          const u = await clerk.users.getUser(userId)
          role = (u.publicMetadata as { role?: string })?.role
        } catch { /* deny on Clerk error */ }
      }
      if (role === "admin") allowed = true
    } else if (channelName.startsWith("private-provider-")) {
      // Provider can only auth their own channel
      const providerId = channelName.replace("private-provider-", "")
      const [prov] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
      allowed = prov?.id === providerId
    } else if (channelName.startsWith("private-booking-")) {
      // M7: booking chat — only the booking's customer or its provider may subscribe.
      const bookingId = channelName.replace("private-booking-", "")
      const [b] = await db
        .select({ customerId: bookings.customerId, providerUserId: providers.userId })
        .from(bookings)
        .leftJoin(providers, eq(bookings.providerId, providers.id))
        .where(eq(bookings.id, bookingId))
      allowed = !!b && (b.customerId === userId || b.providerUserId === userId)
    }

    if (!allowed) return new NextResponse("Forbidden", { status: 403 })

    const authResponse = pusherServer.authorizeChannel(socketId, channelName)
    return NextResponse.json(authResponse)
  } catch (err) {
    console.error("[pusher/auth POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
