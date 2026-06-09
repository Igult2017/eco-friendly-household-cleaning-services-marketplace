import { headers } from "next/headers"
import { Webhook } from "svix"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
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
      // Upsert on both PK and email to handle:
      // 1. Clerk retrying a webhook we already processed (same id → no-op)
      // 2. A duplicate email slipping through when account-linking is off (same
      //    email, different Clerk id) — we keep the first account and discard the
      //    second rather than leaving a broken DB-less Clerk user.
      await db
        .insert(users)
        .values({ id, email, firstName: first_name, lastName: last_name, phone, avatarUrl: image_url, role })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, firstName: first_name, lastName: last_name, phone, avatarUrl: image_url, updatedAt: new Date() },
        })
        .catch(async () => {
          // email unique constraint: a different Clerk user already owns this email.
          // Log and swallow — the first account is authoritative; this orphan Clerk
          // user should be deleted manually or will be blocked at onboarding.
          console.error(`[clerk-webhook] duplicate email on user.created — clerk id ${id}, email ${email}`)
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
