import { headers } from "next/headers"
import { stripe } from "@/lib/stripe/client"
import { redis } from "@/lib/redis/client"
import { db } from "@/lib/db"
import { payments, providers, notifications, bookings, disputes, users } from "@/lib/db/schema"
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

  // Idempotency guard — redis.set NX returns "OK" when the key is newly set (first delivery)
  // and null when the key already existed (duplicate). Skip if already processed.
  const idempotencyKey = `stripe:processed:${event.id}`
  const wasSet = await redis.set(idempotencyKey, "1", { nx: true, ex: 86400 })
  if (wasSet === null) return new Response("Already processed", { status: 200 })

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
        if (meta?.provider_id) {
          await db.update(providers).set({ verificationStatus: "verified" }).where(eq(providers.id, meta.provider_id))
          const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, meta.provider_id))
          if (prov?.userId) {
            await db.insert(notifications).values({
              userId: prov.userId,
              type: "provider_approved",
              title: "Identity verified!",
              body: "Your identity has been verified. You can now accept bookings on DORIXÉ.",
              link: "/dashboard",
            })
          }
        }
        break
      }

      case "identity.verification_session.requires_input": {
        const session = event.data.object as Stripe.Identity.VerificationSession
        const meta = session.metadata as Record<string, string>
        if (meta?.provider_id) {
          await db.update(providers).set({ verificationStatus: "requires_resubmission" }).where(eq(providers.id, meta.provider_id))
          const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, meta.provider_id))
          if (prov?.userId) {
            await db.insert(notifications).values({
              userId: prov.userId,
              type: "provider_suspended",
              title: "Additional documents needed",
              body: "We need more information to verify your identity. Please resubmit your documents.",
              link: "/provider/profile",
            })
          }
        }
        break
      }

      case "charge.dispute.created": {
        // FIN-007: a customer filed a BANK chargeback. Flag the booking, open a dispute record,
        // and alert every admin so it can be contested in Stripe before the evidence deadline.
        const chargeDispute = event.data.object as Stripe.Dispute
        const piId = typeof chargeDispute.payment_intent === "string"
          ? chargeDispute.payment_intent
          : chargeDispute.payment_intent?.id
        if (piId) {
          const [payment] = await db
            .select({ bookingId: payments.bookingId, customerId: payments.customerId })
            .from(payments)
            .where(eq(payments.stripePaymentIntentId, piId))
          if (payment?.bookingId) {
            await db.update(bookings).set({ status: "disputed" }).where(eq(bookings.id, payment.bookingId))
            // Unique index on booking_id makes this idempotent if a dispute already exists.
            await db
              .insert(disputes)
              .values({
                bookingId: payment.bookingId,
                openedBy: payment.customerId,
                status: "open",
                reason: "chargeback",
                description: `Stripe chargeback opened (reason: ${chargeDispute.reason}). Respond in the Stripe dashboard before the evidence deadline.`,
              })
              .onConflictDoNothing()
            const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))
            if (admins.length > 0) {
              await db.insert(notifications).values(
                admins.map((a) => ({
                  userId: a.id,
                  type: "dispute_opened" as const,
                  title: "⚠️ Chargeback opened",
                  body: `A customer filed a bank chargeback (${chargeDispute.reason}). Review and submit evidence in Stripe before the deadline.`,
                  link: "/admin/disputes",
                })),
              )
            }
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
