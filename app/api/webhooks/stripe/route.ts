import { headers } from "next/headers"
import { stripe } from "@/lib/stripe/client"
import { redis } from "@/lib/redis/client"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 })
  }

  const payload = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new Response("Invalid webhook signature", { status: 400 })
  }

  // Idempotency guard — skip if already processed
  const idempotencyKey = `stripe:processed:${event.id}`
  const alreadyProcessed = await redis.set(idempotencyKey, "1", {
    nx: true,
    ex: 86400, // 24 hours
  })
  if (!alreadyProcessed) {
    return new Response("Already processed", { status: 200 })
  }

  try {
    switch (event.type) {
      case "payment_intent.amount_capturable_updated": {
        // PaymentIntent is pre-authorized — booking confirmed
        // Handled in /api/bookings POST after client confirms
        break
      }
      case "payment_intent.payment_failed": {
        // TODO: Update payment row status = 'failed', notify customer
        break
      }
      case "account.updated": {
        // Stripe Connect account status changed
        // TODO: Update providers.stripe_account_status
        break
      }
      case "identity.verification_session.verified": {
        // Provider identity verified via Stripe Identity
        // TODO: Update provider_identity_verifications + providers.verification_status
        break
      }
      case "identity.verification_session.requires_input": {
        // Provider needs to resubmit documents
        // TODO: Update status = 'requires_resubmission', email provider
        break
      }
      default:
        break
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error("[stripe-webhook]", err)
    return new Response("Internal error", { status: 500 })
  }
}
