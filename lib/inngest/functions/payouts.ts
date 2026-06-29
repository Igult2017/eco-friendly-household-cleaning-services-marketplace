import { inngest } from "../client"
import { db } from "@/lib/db"
import { payments, payouts, bookings, providers, users } from "@/lib/db/schema"
import { resend, FROM } from "@/lib/resend/client"
import { weeklyEarningsEmail } from "@/lib/resend/transactionalEmails"
import { eq, and, gte, lte, inArray, isNull } from "drizzle-orm"

// PAYOUT MODEL — read before changing anything here.
// Providers are paid INSTANTLY via Stripe destination charges: the PaymentIntent
// (app/api/payments/intent/route.ts) sets transfer_data.destination + application_fee_amount,
// so at capture (job completion) Stripe routes the provider's share straight into their
// connected account — no separate transfer needed.
// This weekly job is therefore a LEDGER ONLY: it groups each provider's already-paid bookings
// into a payout row + earnings-summary email. It must NOT call stripe.transfers.create —
// doing so would pay the provider a second time for the same bookings.

export const weeklyPayoutRun = inngest.createFunction(
  { id: "weekly-payout-run", retries: 3, triggers: [{ cron: "0 2 * * 1" }] },
  async ({ step }: { step: any }) => {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(now.getDate() - 1)
    const periodStart = new Date(periodEnd)
    periodStart.setDate(periodEnd.getDate() - 6)

    const periodStartStr = periodStart.toISOString().split("T")[0]
    const periodEndStr = periodEnd.toISOString().split("T")[0]

    const capturedPayments = await step.run("find-captured-payments", async () => {
      // Bug 3: filter payoutId IS NULL — prevents re-processing payments already settled
      return db
        .select({ id: payments.id, bookingId: payments.bookingId, capturedAmount: payments.capturedAmount })
        .from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .where(and(
          eq(payments.status, "captured"),
          gte(payments.capturedAt, periodStart),
          lte(payments.capturedAt, periodEnd),
          isNull(payments.payoutId),
        ))
    })

    if (capturedPayments.length === 0) return { processed: 0 }

    const bookingIds = capturedPayments.map((p: { bookingId: string }) => p.bookingId)
    const providerBookings = await step.run("group-by-provider", async () => {
      return db
        .select({ id: bookings.id, providerId: bookings.providerId, providerPayout: bookings.providerPayout })
        .from(bookings)
        .where(inArray(bookings.id, bookingIds))
    })

    const byProvider = new Map<string, { providerPayout: number; bookingIds: string[] }>()
    for (const b of providerBookings as { id: string; providerId: string; providerPayout: number }[]) {
      const existing = byProvider.get(b.providerId)
      if (existing) {
        existing.providerPayout += b.providerPayout
        existing.bookingIds.push(b.id)
      } else {
        byProvider.set(b.providerId, { providerPayout: b.providerPayout, bookingIds: [b.id] })
      }
    }

    const events = Array.from(byProvider.keys()).map((providerId) => ({
      name: "payout/process-provider" as const,
      data: { providerId, periodStart: periodStartStr, periodEnd: periodEndStr },
    }))

    if (events.length > 0) await inngest.send(events)

    return { processed: events.length, periodStart: periodStartStr, periodEnd: periodEndStr }
  }
)

export const processProviderPayout = inngest.createFunction(
  { id: "process-provider-payout", retries: 2, triggers: [{ event: "payout/process-provider" }] },
  async ({ event, step }: { event: { data: { providerId: string; periodStart: string; periodEnd: string } }; step: any }) => {
    const { providerId, periodStart, periodEnd } = event.data

    const provider = await step.run("fetch-provider", async () => {
      const [p] = await db
        .select({ id: providers.id, stripeAccountId: providers.stripeAccountId, userId: providers.userId, businessName: providers.businessName })
        .from(providers)
        .where(eq(providers.id, providerId))
      return p
    })

    if (!provider?.stripeAccountId) return { skipped: true, reason: "no_stripe_account" }

    const periodStartDate = new Date(periodStart)
    const periodEndDate = new Date(periodEnd)

    const providerBookingRows = await step.run("fetch-bookings", async () => {
      // Bug 3: also filter payoutId IS NULL here in case new payments were added since weeklyPayoutRun
      return db
        .select({ id: bookings.id, providerPayout: bookings.providerPayout, refundedAmount: payments.refundedAmount, paymentId: payments.id, currency: payments.currency })
        .from(bookings)
        .innerJoin(payments, eq(bookings.id, payments.bookingId))
        .where(and(
          eq(bookings.providerId, providerId),
          eq(bookings.status, "completed"),
          eq(payments.status, "captured"),
          gte(payments.capturedAt, periodStartDate),
          lte(payments.capturedAt, periodEndDate),
          isNull(payments.payoutId),
        ))
    })

    if (providerBookingRows.length === 0) return { skipped: true, reason: "no_bookings" }

    const rows = providerBookingRows as { id: string; providerPayout: number; refundedAmount: number; paymentId: string; currency: string }[]
    const totalPayout = rows.reduce((sum: number, b) => sum + Math.max(0, b.providerPayout - (b.refundedAmount ?? 0)), 0)
    // Ledger currency = the currency these bookings were actually captured in (the cleaner's own).
    const payoutCurrency = rows[0]?.currency ?? "eur"
    const bookingIdList = rows.map((b: { id: string }) => b.id)
    const paymentIdList = rows.map((b: { paymentId: string }) => b.paymentId)

    // No stripe.transfers.create here — the provider was already paid at capture via the
    // destination charge. We only record a ledger row summarising the period's earnings.
    const [payout] = await step.run("record-payout", async () => {
      return db
        .insert(payouts)
        .values({
          providerId,
          stripeTransferId: null, // ledger entry; funds moved via destination charge, not a transfer
          status: "paid",
          amount: totalPayout,
          currency: payoutCurrency,
          periodStart,
          periodEnd,
          bookingIds: bookingIdList,
          processedAt: new Date(),
        })
        .returning({ id: payouts.id })
    })

    // Mark these payments as ledgered — prevents the same bookings being summarised twice
    // on an Inngest retry or in a later run.
    await step.run("mark-payments-settled", async () => {
      await db
        .update(payments)
        .set({ payoutId: payout.id })
        .where(inArray(payments.id, paymentIdList))
    })

    await step.run("email-provider", async () => {
      const [user] = await db
        .select({ email: users.email, firstName: users.firstName, locale: users.locale })
        .from(users)
        .where(eq(users.id, provider.userId))
      if (!user?.email) return
      const { subject, html } = weeklyEarningsEmail(user.locale, {
        name: user.firstName,
        amount: `€${(totalPayout / 100).toFixed(2)}`,
        count: bookingIdList.length,
        start: String(periodStart),
        end: String(periodEnd),
      })
      await resend.emails.send({ from: FROM, to: user.email, subject, html })
    })

    return { payoutId: payout.id, amount: totalPayout, ledger: true }
  }
)
