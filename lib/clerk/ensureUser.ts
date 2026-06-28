import { clerkClient } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const VALID_ROLES = ["customer", "provider", "admin", "affiliate"] as const
type Role = (typeof VALID_ROLES)[number]

/**
 * Guarantee a local `users` row exists for a Clerk user id BEFORE inserting any row
 * that foreign-keys to users.id (providers, referrals, …). Backstops the documented
 * "Clerk webhook never fired / admin provisioned directly in Clerk" gap that otherwise
 * caused `providers_user_id_fkey` violations surfacing as opaque 500s.
 *
 * Idempotent and safe to call on every request. Returns true if the row exists (or was
 * just created), false if it genuinely could not be created (e.g. an email-unique
 * collision with a different account) — callers should then return a clean error
 * rather than letting Postgres throw.
 */
export async function ensureUserRow(userId: string): Promise<boolean> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId))
  if (existing) return true

  try {
    const clerk = await clerkClient()
    const u = await clerk.users.getUser(userId)
    const email =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      `${userId}@no-email.dorixe.local`
    const rawRole = (u.publicMetadata as { role?: string } | undefined)?.role
    const role: Role = (VALID_ROLES as readonly string[]).includes(rawRole ?? "") ? (rawRole as Role) : "customer"

    await db
      .insert(users)
      .values({
        id: u.id,
        email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phoneNumbers[0]?.phoneNumber ?? null,
        avatarUrl: u.imageUrl,
        role,
      })
      // Race / duplicate-email safety: never throw, just skip and re-check below.
      .onConflictDoNothing()
  } catch (e) {
    console.warn("[ensureUserRow] could not create users row:", e instanceof Error ? e.message : e)
  }

  const [after] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId))
  return !!after
}
