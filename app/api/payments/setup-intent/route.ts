import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { getOrCreateStripeCustomer } from "@/lib/stripe/getOrCreateCustomer"
import { createRateLimiter, safeLimit } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

// L2: throttle SetupIntent / Stripe customer creation (resource-abuse prevention).
const setupIntentRatelimit = createRateLimiter({ tokens: 10, windowSeconds: 600, prefix: "ratelimit:setup-intent" })

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success } = await safeLimit(setupIntentRatelimit, userId)
    if (!success) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 })

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId))

    // Any signed-in account may save a card: dual-role cleaners and admins also book as clients,
    // and the customer-only gate dead-ended their checkout card-save fallback with a 403.
    if (!user) {
      return NextResponse.json({ error: "Account not found. Please reload and try again." }, { status: 403 })
    }

    // Shared with the real booking-checkout flow (app/api/payments/intent) so a card saved here is
    // actually found there — see the comment in getOrCreateStripeCustomer for why this matters.
    const stripeCustomerId = await getOrCreateStripeCustomer(userId)

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
    })

    return NextResponse.json({ clientSecret: setupIntent.client_secret, stripeCustomerId })
  } catch (err) {
    console.error("[payments/setup-intent POST]", err)
    void logError({ message: "[payments/setup-intent POST]", error: err, route: "/api/payments/setup-intent", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
