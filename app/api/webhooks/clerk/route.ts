import { headers } from "next/headers"
import { Webhook } from "svix"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { UserRole } from "@/types"

interface ClerkUserEvent {
  type: "user.created" | "user.updated" | "user.deleted"
  data: {
    id: string
    email_addresses: { email_address: string; id: string }[]
    first_name: string | null
    last_name: string | null
    phone_numbers: { phone_number: string }[]
    image_url: string
    public_metadata: { role?: UserRole }
    deleted?: boolean
  }
}

export async function POST(req: Request) {
  const headersList = await headers()
  const svixId = headersList.get("svix-id")
  const svixTimestamp = headersList.get("svix-timestamp")
  const svixSignature = headersList.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const payload = await req.text()
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)

  let event: ClerkUserEvent
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent
  } catch {
    return new Response("Invalid webhook signature", { status: 400 })
  }

  const { id, email_addresses, first_name, last_name, phone_numbers, image_url, public_metadata } =
    event.data

  const email = email_addresses[0]?.email_address ?? ""
  const phone = phone_numbers[0]?.phone_number ?? null
  const role = public_metadata?.role ?? "customer"

  try {
    if (event.type === "user.created") {
      await db.insert(users).values({
        id,
        email,
        firstName: first_name,
        lastName: last_name,
        phone,
        avatarUrl: image_url,
        role,
      })
    }

    if (event.type === "user.updated") {
      await db
        .update(users)
        .set({
          email,
          firstName: first_name,
          lastName: last_name,
          phone,
          avatarUrl: image_url,
          role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
    }

    if (event.type === "user.deleted") {
      await db
        .update(users)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(users.id, id))
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error("[clerk-webhook]", err)
    return new Response("Internal error", { status: 500 })
  }
}
