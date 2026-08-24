import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "./client"

// Single source of truth for "which Stripe customer represents this DORIXÉ user." Found while
// building the optional card-at-signup step: the booking checkout flow and the save-a-card flow
// each searched Stripe under a DIFFERENT metadata key (clerk_id vs userId) and never checked the
// users.stripeCustomerId column at all — meaning a card saved through one flow was invisible to
// the other, silently creating a second Stripe customer instead of reusing the first. This is now
// the only place either flow resolves a customer, so both land on the same one.
//
// Order: the DB column (fast, no Stripe call) → the legacy `metadata.clerk_id` search (covers
// every customer created before this fix existed, so they aren't orphaned) → create fresh. The
// resolved id is always written back to the DB column so every later lookup skips straight to it.
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId, email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))

  if (user?.stripeCustomerId) return user.stripeCustomerId

  const existing = await stripe.customers.search({ query: `metadata['clerk_id']:'${userId}'`, limit: 1 })
  if (existing.data[0]) {
    await db.update(users).set({ stripeCustomerId: existing.data[0].id }).where(eq(users.id, userId))
    return existing.data[0].id
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined
  const created = await stripe.customers.create(
    { email: user?.email ?? undefined, name: fullName, metadata: { userId, clerk_id: userId } },
    { idempotencyKey: `cus-create-${userId}` },
  )
  await db.update(users).set({ stripeCustomerId: created.id }).where(eq(users.id, userId))
  return created.id
}
