import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/client"
import { getOrCreateStripeCustomer } from "@/lib/stripe/getOrCreateCustomer"
import { createRateLimiter, safeLimit } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

const customerSessionRatelimit = createRateLimiter({ tokens: 20, windowSeconds: 600, prefix: "ratelimit:customer-session" })

// Lets the checkout SHOW the card the client already saved, instead of asking for it again.
//
// Why this exists: a client reported "I had to add my credit card at signup, and then again when
// paying — now I have the same card on file twice." Stripe's docs are explicit that "a Customer
// Session is required for the Payment Element to redisplay saved payment methods", and we never
// created one, so checkout always rendered an empty card form. The card was then saved a second
// time by setup_future_usage on the PaymentIntent.
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success } = await safeLimit(customerSessionRatelimit, userId)
    if (!success) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 })

    // Same customer the checkout and the save-a-card flow use, or the saved card wouldn't be found.
    const customer = await getOrCreateStripeCustomer(userId)

    const session = await stripe.customerSessions.create({
      customer,
      components: {
        payment_element: {
          enabled: true,
          features: {
            // Show cards saved earlier, and let the client manage them rather than re-typing.
            payment_method_save: "enabled",
            payment_method_remove: "enabled",
            payment_method_redisplay: "enabled",
            // Cards saved by the signup step carry no redisplay preference ("unspecified"), and
            // Stripe hides those by default — which would leave the existing card invisible even
            // with this session. Including "unspecified" is what actually surfaces Simon's card.
            payment_method_allow_redisplay_filters: ["always", "limited", "unspecified"],
          },
        },
      },
    })

    return NextResponse.json({ customerSessionClientSecret: session.client_secret })
  } catch (err) {
    console.error("[payments/customer-session POST]", err)
    void logError({ message: "[payments/customer-session POST]", error: err, route: "/api/payments/customer-session", severity: "error" })
    return NextResponse.json({ error: "Could not prepare the payment form. Please try again." }, { status: 500 })
  }
}
