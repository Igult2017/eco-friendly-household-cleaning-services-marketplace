import { headers } from "next/headers"
import { stripe } from "@/lib/stripe/client"
import { redis } from "@/lib/redis/client"
import { db } from "@/lib/db"
import { payments, providers, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response("Invalid webhook signature", { status: 400 })
  }

  // Idempotency guard
  const idempotencyKey = `stripe:processed:${event.id}`
  const alreadyProcessed = await redis.set(idempotencyKey, "1", { nx: true, ex: 86400 })
  if (!alreadyProcessed) return new Response("Already processed", { status: 200 })

  try {
    switch (event.type) {
      case "payment_intent.amount_capturable_updated": {
        // Pre-auth confirmed — booking creation handled in /api/bookings POST
        break
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent
        await db.update(payments).set({
          status: "failed",
          failureCode: pi.last_payment_error?.code ?? "unknown",
        }).where(eq(payments.stripePaymentIntentId, pi.id))

        const [payment] = await db.select({ customerId: payments.customerId }).from(payments).where(eq(payments.stripePaymentIntentId, pi.id))
        if (payment?.customerId) {
          await db.insert(notifications).values({
            userId: payment.customerId,
            type: "booking_cancelled",
            title: "Payment failed",
            body: "Your payment could not be processed. Please try again with a different payment method.",
            link: "/dashboard",
          })
        }
        break
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account
        const status = account.charges_enabled ? "active" : account.details_submitted ? "pending" : "incomplete"
        await db.update(providers).set({ stripeAccountStatus: status }).where(eq(providers.stripeAccountId, account.id))
        break
      }

      case "identity.verification_session.verified": {
        const session = event.data.object as Stripe.Identity.VerificationSession
        const meta = session.metadata as Record<string, string>
        if (meta?.providerId) {
          await db.update(providers).set({ verificationStatus: "verified" }).where(eq(providers.id, meta.providerId))
          const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, meta.providerId))
          if (prov?.userId) {
            await db.insert(notifications).values({
              userId: prov.userId,
              type: "provider_approved",
              title: "Identity verified!",
              body: "Your identity has been verified. You can now accept bookings on DORIX.",
              link: "/dashboard",
            })
          }
        }
        break
      }

      case "identity.verification_session.requires_input": {
        const session = event.data.object as Stripe.Identity.VerificationSession
        const meta = session.metadata as Record<string, string>
        if (meta?.providerId) {
          await db.update(providers).set({ verificationStatus: "requires_resubmission" }).where(eq(providers.id, meta.providerId))
          const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, meta.providerId))
          if (prov?.userId) {
            await db.insert(notifications).values({
              userId: prov.userId,
              type: "provider_suspended",
              title: "Additional documents needed",
              body: "We need more information to verify your identity. Please resubmit your documents.",
              link: "/onboarding/provider",
            })
          }
        }
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
