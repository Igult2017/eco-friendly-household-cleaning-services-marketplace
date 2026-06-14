import { verifyWebhook } from "@clerk/nextjs/webhooks"
import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { UserRole } from "@/types"

const VALID_ROLES: UserRole[] = ["customer", "provider", "admin"]

function resolveRole(publicMetadata: unknown): UserRole {
  const raw = (publicMetadata as { role?: string } | undefined)?.role
  return VALID_ROLES.includes(raw as UserRole) ? (raw as UserRole) : "customer"
}

export async function POST(req: NextRequest) {
  // Verify with Clerk's official helper (Standard Webhooks under the hood).
  // We pass signingSecret explicitly because our env var is CLERK_WEBHOOK_SECRET,
  // whereas verifyWebhook otherwise auto-reads CLERK_WEBHOOK_SIGNING_SECRET.
  let evt
  try {
    evt = await verifyWebhook(req, { signingSecret: process.env.CLERK_WEBHOOK_SECRET })
  } catch (err) {
    console.error("[clerk-webhook] verification failed:", err)
    return new Response("Verification failed", { status: 400 })
  }

  try {
    if (evt.type === "user.created") {
      const { id, email_addresses, first_name, last_name, phone_numbers, image_url } = evt.data
      const email = email_addresses[0]?.email_address ?? ""
      const phone = phone_numbers[0]?.phone_number ?? null
      // Upsert on PK to handle Clerk retrying a webhook we already processed.
      await db
        .insert(users)
        .values({
          id,
          email,
          firstName: first_name,
          lastName: last_name,
          phone,
          avatarUrl: image_url,
          role: resolveRole(evt.data.public_metadata),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, firstName: first_name, lastName: last_name, phone, avatarUrl: image_url, updatedAt: new Date() },
        })
        .catch(() => {
          // email unique constraint: a different Clerk user already owns this email.
          // The first account is authoritative; log and swallow rather than 500 (which
          // would make Svix retry forever).
          console.error(`[clerk-webhook] duplicate email on user.created — clerk id ${id}, email ${email}`)
        })
    }

    if (evt.type === "user.updated") {
      const { id, email_addresses, first_name, last_name, phone_numbers, image_url } = evt.data
      await db
        .update(users)
        .set({
          email: email_addresses[0]?.email_address ?? "",
          firstName: first_name,
          lastName: last_name,
          phone: phone_numbers[0]?.phone_number ?? null,
          avatarUrl: image_url,
          role: resolveRole(evt.data.public_metadata),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
    }

    if (evt.type === "user.deleted" && evt.data.id) {
      await db
        .update(users)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(users.id, evt.data.id))
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error("[clerk-webhook]", err)
    return new Response("Internal error", { status: 500 })
  }
}
