import { headers } from "next/headers"
import { stripe } from "@/lib/stripe/client"
import { redis } from "@/lib/redis/client"
import { db } from "@/lib/db"
import { payments, providers, notifications, bookings, disputes, users } from "@/lib/db/schema"
import { clawbackReferralCommission } from "@/lib/referrals/clawback"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { logError } from "@/lib/utils/logError"
import { recordPaymentEvent } from "@/lib/payments/ledger"
import { alertAdmins } from "@/lib/notifications/adminAlert"

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

  // Idempotency guard (M1). Distinguish a genuine duplicate from Redis being unavailable: only a
  // CONFIRMED duplicate is skipped. If Redis is down we still PROCESS the event (handlers are
  // DB-idempotent) rather than silently dropping payment_failed / dispute / account.updated events
  // with a 200 that makes Stripe stop retrying.
  const idempotencyKey = `stripe:processed:${event.id}`
  const acquired = await redis.acquireOnce(idempotencyKey, 86400)
  if (acquired === "duplicate") return new Response("Already processed", { status: 200 })

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
        // payouts_enabled, not charges_enabled — mirrors lib/stripe/connect.ts's getConnectAccountStatus.
        // Connected accounts only request "transfers", never "card_payments", so charges_enabled would
        // never turn true here either.
        const status = account.payouts_enabled ? "active" : account.details_submitted ? "pending" : "incomplete"
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
              // Provider recipient — /dashboard is the CLIENT dashboard; open their support thread.
              link: "/provider/support",
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

      case "charge.dispute.closed": {
        // Stripe/the bank can resolve a chargeback on its own, without anyone going through
        // /admin/disputes/[id]/resolve — previously this app had no way to find out, so the
        // booking stayed stuck "disputed" forever and a referral commission already paid on it
        // never got clawed back. Never re-issue a refund here — Stripe already moved the money
        // automatically on a loss; this only reflects that reality in our own records.
        const closedDispute = event.data.object as Stripe.Dispute
        const closedPiId = typeof closedDispute.payment_intent === "string"
          ? closedDispute.payment_intent
          : closedDispute.payment_intent?.id
        if (closedPiId) {
          const [payment] = await db
            .select({ bookingId: payments.bookingId, customerId: payments.customerId })
            .from(payments)
            .where(eq(payments.stripePaymentIntentId, closedPiId))
          if (payment?.bookingId) {
            const [existingDispute] = await db
              .select({ id: disputes.id, status: disputes.status })
              .from(disputes)
              .where(eq(disputes.bookingId, payment.bookingId))
            // A human already resolved this through the admin flow — don't override that decision.
            const alreadyResolved = existingDispute && ["resolved_customer", "resolved_provider", "closed"].includes(existingDispute.status)
            if (!alreadyResolved) {
              const won = closedDispute.status === "won" // platform/cleaner kept the money
              if (won) {
                await db.update(bookings).set({ status: "completed" }).where(eq(bookings.id, payment.bookingId))
                if (existingDispute) {
                  await db.update(disputes).set({
                    status: "resolved_provider", resolvedAt: new Date(),
                    resolution: "Stripe resolved the bank chargeback in the cleaner's favor — no funds were reversed.",
                  }).where(eq(disputes.id, existingDispute.id))
                }
              } else {
                await db.update(payments).set({ refundedAmount: closedDispute.amount, status: "refunded" }).where(eq(payments.bookingId, payment.bookingId))
                await db.update(bookings).set({ status: "refunded" }).where(eq(bookings.id, payment.bookingId))
                if (existingDispute) {
                  await db.update(disputes).set({
                    status: "resolved_customer", resolvedAt: new Date(),
                    resolution: "Stripe resolved the bank chargeback in the customer's favor; funds were withdrawn automatically.",
                  }).where(eq(disputes.id, existingDispute.id))
                }
                await clawbackReferralCommission(payment.bookingId)
              }
              await alertAdmins(
                won ? "A chargeback resolved in the cleaner's favor" : "⚠️ A chargeback resolved against DORIXÉ — funds were withdrawn",
                `Stripe closed the chargeback on booking ${payment.bookingId} as "${closedDispute.status}" without going through the admin dispute flow. Records have been updated to match.`,
                "/admin/disputes",
              )
            }
          }
        }
        break
      }

      // Connect events (fired against a cleaner's connected account, not the platform account) —
      // this app previously had no way to learn whether a real bank transfer actually succeeded
      // or failed after everything on DORIXÉ's own side already went through. Requires the Stripe
      // Dashboard webhook endpoint to have "Listen to events on Connected accounts" turned on;
      // that's a Stripe configuration setting, not something this code can verify or control.
      case "payout.paid":
      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout
        const connectedAccountId = event.account
        if (!connectedAccountId) break
        const [prov] = await db
          .select({ id: providers.id, userId: providers.userId, businessName: providers.businessName })
          .from(providers)
          .where(eq(providers.stripeAccountId, connectedAccountId))
        if (!prov) break

        const succeeded = event.type === "payout.paid"
        await recordPaymentEvent({
          userId: prov.userId,
          kind: succeeded ? "payout_succeeded" : "payout_failed",
          amountCents: payout.amount,
          stripeObjectId: payout.id,
          status: succeeded ? "succeeded" : "failed",
          metadata: succeeded ? {} : { reason: payout.failure_message ?? payout.failure_code ?? "unknown" },
        })

        if (!succeeded) {
          await db.insert(notifications).values({
            userId: prov.userId,
            type: "payment_automation_failed",
            title: "Your bank payout failed",
            body: `Stripe couldn't send €${(payout.amount / 100).toFixed(2)} to your bank account (${payout.failure_message ?? "reason not given"}). Check your bank details in Earnings and reconnect if needed.`,
            link: "/provider/earnings",
          })
          await alertAdmins(
            "⚠️ A cleaner's bank payout failed",
            `Stripe's real bank transfer to ${prov.businessName ?? prov.id} failed after everything on our side succeeded: ${payout.failure_message ?? payout.failure_code ?? "unknown reason"}.`,
            "/admin/payments/history",
          )
        }
        break
      }

      default:
        break
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error("[stripe-webhook]", err)
    void logError({ message: "[stripe-webhook]", error: err, route: "/api/webhooks/stripe", severity: "critical" })
    // The idempotency key was set BEFORE handling (to dedupe concurrent deliveries). A failed handler
    // must release it so Stripe's retry re-processes — otherwise the retry is skipped as a "duplicate"
    // and the event (dispute / payment_failed / account.updated) is silently lost.
    await redis.del(idempotencyKey)
    return new Response("Internal error", { status: 500 })
  }
}
