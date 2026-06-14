import { clerkClient } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import type { UserRole } from "@/types"

const VALID_ROLES: UserRole[] = ["customer", "provider", "admin"]
const PAGE_SIZE = 100

export interface SyncResult {
  clerkTotal: number
  dbTotal: number
  created: number
  createdEmails: string[]
}

/**
 * Reconcile the local users table against Clerk (the source of truth for who
 * signed up). Any Clerk user missing from the DB is inserted. This is the
 * safety net for when the Clerk webhook fails to fire — without it, users who
 * sign up but never finish onboarding are invisible in the admin panel.
 *
 * Idempotent: existing rows are left untouched (role/profile stay owned by
 * onboarding + the admin role manager). Only genuinely missing users are added.
 */
export async function syncClerkUsers(): Promise<SyncResult> {
  const clerk = await clerkClient()

  // 1. Pull every Clerk user (paginated).
  const clerkUsers: Awaited<ReturnType<typeof clerk.users.getUserList>>["data"] = []
  let offset = 0
  let clerkTotal = 0
  for (;;) {
    const page = await clerk.users.getUserList({ limit: PAGE_SIZE, offset })
    clerkTotal = page.totalCount
    clerkUsers.push(...page.data)
    offset += page.data.length
    if (page.data.length < PAGE_SIZE || offset >= clerkTotal) break
  }

  // 2. Which IDs already exist locally?
  const existing = await db.select({ id: users.id }).from(users)
  const existingIds = new Set(existing.map((u) => u.id))

  // 3. Insert the ones that don't.
  const missing = clerkUsers.filter((u) => !existingIds.has(u.id))
  const createdEmails: string[] = []

  for (const u of missing) {
    const email =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      ""
    const rawRole = (u.publicMetadata as { role?: string } | undefined)?.role
    const role: UserRole = VALID_ROLES.includes(rawRole as UserRole)
      ? (rawRole as UserRole)
      : "customer"

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
      // Race / duplicate-email safety: never throw, just skip.
      .onConflictDoNothing()

    createdEmails.push(email || u.id)
  }

  return {
    clerkTotal,
    dbTotal: existingIds.size + createdEmails.length,
    created: createdEmails.length,
    createdEmails,
  }
}
