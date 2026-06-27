import { verifyWebhook } from "@clerk/nextjs/webhooks"
import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { UserRole } from "@/types"
import { logError } from "@/lib/utils/logError"

const VALID_ROLES: UserRole[] = ["customer", "provider", "admin"]

function resolveRole(publicMetadata: unknown): UserRole {
  const raw = (publicMetadata as { role?: string } | undefined)?.role
  // H5: NEVER accept "admin" from a webhook payload. Admin is granted only via an authenticated
  // admin action; a forged/replayed event (leaked signing secret) must not be able to provision a
  // DB admin. Only the self-service onboarding roles are honoured here.
  if (raw === "customer" || raw === "provider") return raw
  return "customer"
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
        .catch(async () => {
          // email unique constraint hit. BUG-007: the usual cause is that this person
          // previously deleted their account — user.deleted soft-deletes (row + email kept)
          // — and signed up again with a NEW Clerk id. Without handling this, the new id
          // gets no DB row and the account is orphaned (auth works, every DB lookup is null).
          try {
            const [existing] = await db
              .select({ id: users.id, deletedAt: users.deletedAt })
              .from(users)
              .where(eq(users.email, email))
            if (existing && existing.deletedAt && existing.id !== id) {
              // Stale, soft-deleted account: free its email (tombstone, kept FK-intact) and
              // create the new account so the new Clerk id is properly linked.
              await db.update(users).set({ email: `deleted+${existing.id}@dorixe.invalid` }).where(eq(users.id, existing.id))
              await db
                .insert(users)
                .values({ id, email, firstName: first_name, lastName: last_name, phone, avatarUrl: image_url, role: resolveRole(evt.data.public_metadata) })
                .onConflictDoNothing()
              console.warn(`[clerk-webhook] reclaimed email for new clerk id ${id} from soft-deleted ${existing.id}`)
            } else {
              // An ACTIVE different account already owns this email — do NOT hijack it.
              console.error(`[clerk-webhook] duplicate email on user.created — clerk id ${id}, email ${email} (active account exists; not reclaiming)`)
            }
          } catch (reclaimErr) {
            console.error(`[clerk-webhook] failed to reclaim email for clerk id ${id}:`, reclaimErr)
          }
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
    void logError({ message: "[clerk-webhook]", error: err, route: "/api/webhooks/clerk", severity: "critical" })
    return new Response("Internal error", { status: 500 })
  }
}
