import { inngest } from "../client"
import { db } from "@/lib/db"
import { payments, payouts, bookings, providers, users } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { resend, FROM } from "@/lib/resend/client"
import { eq, and, gte, lte, inArray } from "drizzle-orm"

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
      return db
        .select({ id: payments.id, bookingId: payments.bookingId, capturedAmount: payments.capturedAmount })
        .from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .where(and(eq(payments.status, "captured"), gte(payments.capturedAt, periodStart), lte(payments.capturedAt, periodEnd)))
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
      return db
        .select({ id: bookings.id, providerPayout: bookings.providerPayout, refundedAmount: payments.refundedAmount })
        .from(bookings)
        .innerJoin(payments, eq(bookings.id, payments.bookingId))
        .where(and(
          eq(bookings.providerId, providerId),
          eq(bookings.status, "completed"),       // exclude cancelled/disputed/refunded bookings
          eq(payments.status, "captured"),
          gte(payments.capturedAt, periodStartDate),
          lte(payments.capturedAt, periodEndDate),
        ))
    })

    if (providerBookingRows.length === 0) return { skipped: true, reason: "no_bookings" }

    const rows = providerBookingRows as { id: string; providerPayout: number; refundedAmount: number }[]
    // Subtract any refunded amounts so providers aren't overpaid on disputed bookings
    const totalPayout = rows.reduce((sum: number, b) => sum + Math.max(0, b.providerPayout - (b.refundedAmount ?? 0)), 0)
    const bookingIdList = rows.map((b: { id: string }) => b.id)

    const transfer = await step.run("stripe-transfer", async () => {
      return stripe.transfers.create(
        {
          amount: totalPayout,
          currency: "eur",
          destination: provider.stripeAccountId!,
          metadata: { provider_id: providerId, period_start: periodStart, period_end: periodEnd },
        },
        { idempotencyKey: `transfer-${providerId}-${periodStart}-${periodEnd}` },
      )
    })

    const [payout] = await step.run("record-payout", async () => {
      return db
        .insert(payouts)
        .values({ providerId, stripeTransferId: transfer.id, status: "paid", amount: totalPayout, currency: "eur", periodStart, periodEnd, bookingIds: bookingIdList, processedAt: new Date() })
        .returning({ id: payouts.id })
    })

    await step.run("email-provider", async () => {
      const [user] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, provider.userId))
      if (!user?.email) return
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: `Payout of €${(totalPayout / 100).toFixed(2)} sent to your account`,
        html: `
          <h2>Your weekly payout is on the way!</h2>
          <p>Hi ${user.firstName ?? "there"},</p>
          <p>We've sent <strong>€${(totalPayout / 100).toFixed(2)}</strong> to your connected bank account.</p>
          <p>Period: ${periodStart} to ${periodEnd} | Bookings: ${bookingIdList.length}</p>
          <p>Transfers typically arrive within 1–2 business days.</p>
          <p>Thank you for being part of DORIX 🌿</p>
        `,
      })
    })

    return { payoutId: payout.id, amount: totalPayout, transferId: transfer.id }
  }
)
