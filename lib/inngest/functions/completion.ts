import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, payments, users, notifications, providers } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { resend, FROM } from "@/lib/resend/client"
import { reviewRequestEmail, reviewReminderEmail } from "@/lib/resend/transactionalEmails"
import { eq, and, sql } from "drizzle-orm"
import { creditReferralReward } from "@/lib/referrals/rewards"

export const onBookingCompleted = inngest.createFunction(
  { id: "booking-completed", retries: 3, triggers: [{ event: "booking/completed" }] },
  async ({ event, step }: { event: { data: { bookingId: string; paymentIntentId: string; providerId: string; customerId: string } }; step: any }) => {
    const { bookingId, paymentIntentId, providerId, customerId } = event.data

    // Split capture and DB write into separate steps so a DB failure on retry
    // doesn't re-hit Stripe — the idempotency key ensures Stripe deduplicates.
    // Late penalty (5%/day) the cleaner accrued by completing an overdue job — computed at /complete.
    // Applied here: client is charged that much less and the cleaner's transfer is reduced by it.
    const penalty = await step.run("fetch-penalty", async () => {
      const [bk] = await db.select({ p: bookings.latePenaltyAmount }).from(bookings).where(eq(bookings.id, bookingId))
      return Number(bk?.p ?? 0)
    })

    const captureResult = await step.run("stripe-capture", async () => {
      // Don't capture a card on a booking that was disputed/cancelled after /complete fired — the
      // dispute-open route allows opening a dispute while status is pending_capture. Re-check first.
      // (This event only fires once BOTH parties confirmed or an admin released — see complete/confirm.)
      const [bk] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId))
      if (!bk || bk.status !== "pending_capture") return null
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      // Normal path: the manual-capture hold is still alive → capture it (minus any late penalty).
      if (pi.status === "requires_capture") {
        const opts = penalty > 0 ? { amount_to_capture: pi.amount - penalty, application_fee_amount: pi.application_fee_amount ?? undefined } : {}
        return stripe.paymentIntents.capture(paymentIntentId, opts, { idempotencyKey: `capture-${paymentIntentId}` })
      }
      // Already captured (an Inngest retry) → reuse it.
      if (pi.status === "succeeded") return pi
      // The ~7-day hold lapsed while we waited for confirmation → charge the SAVED card off-session
      // (setup_future_usage saved it at booking). Same destination + fee, so the split is identical.
      if (pi.status === "canceled") {
        const pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id
        const custId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id
        const dest = pi.transfer_data?.destination
        const destId = typeof dest === "string" ? dest : dest?.id
        if (!pmId || !custId || !destId) return null
        return stripe.paymentIntents.create({
          amount: pi.amount - penalty,
          currency: pi.currency,
          customer: custId,
          payment_method: pmId,
          confirm: true,
          off_session: true,
          application_fee_amount: pi.application_fee_amount ?? undefined,
          transfer_data: { destination: destId },
          metadata: pi.metadata,
        }, { idempotencyKey: `offsession-capture-${bookingId}` })
      }
      return null
    })

    if (!captureResult) return { skipped: "not_pending_capture" }

    await step.run("record-capture", async () => {
      // Match by bookingId (the off-session fallback creates a NEW PaymentIntent id) and store
      // whichever PI actually collected the money.
      await db
        .update(payments)
        .set({ status: "captured", capturedAmount: captureResult.amount_received ?? captureResult.amount, capturedAt: new Date(), stripePaymentIntentId: captureResult.id })
        .where(eq(payments.bookingId, bookingId))
    })

    await step.run("update-booking", async () => {
      // Only flip to completed if still pending_capture — never clobber a status a chargeback
      // webhook moved to `disputed` (or an admin moved to cancelled/refunded) while capture was
      // in flight.
      const updated = await db.update(bookings).set({ status: "completed" }).where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending_capture"))).returning({ id: bookings.id })
      // Increment the cleaner's lifetime completed-jobs counter exactly once — only when THIS call
      // performed the flip, so it stays idempotent across Inngest retries.
      if (updated.length > 0) {
        await db.update(providers).set({ totalJobsCompleted: sql`total_jobs_completed + 1` }).where(eq(providers.id, providerId))
        // Restate the money fields so earnings + receipts reflect the late penalty that was applied.
        if (penalty > 0) {
          await db.update(bookings).set({ totalAmount: sql`total_amount - ${penalty}`, providerPayout: sql`provider_payout - ${penalty}` }).where(eq(bookings.id, bookingId))
        }
      }
    })

    await step.run("notify-customer", async () => {
      await db.insert(notifications).values({
        userId: customerId,
        type: "booking_completed",
        title: "Cleaning Complete — Leave a Review",
        body: "Your cleaning session is done! Share your experience to help others.",
        link: `/bookings/${bookingId}/review`,
      })
    })

    const customer = await step.run("fetch-customer", async () => {
      const [c] = await db.select({ email: users.email, firstName: users.firstName, locale: users.locale, emailReminders: users.emailReminders }).from(users).where(eq(users.id, customerId))
      return c
    })

    await step.run("email-customer-review", async () => {
      if (!customer?.email || !customer.emailReminders) return
      const { subject, html } = reviewRequestEmail(customer.locale, {
        name: customer.firstName,
        reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}/review`,
      })
      await resend.emails.send({ from: FROM, to: customer.email, subject, html })
    })

    // Process referral rewards. Two independent trigger sides fire off the SAME completed booking
    // — the referred person's own natural transaction on it: the customer (covers cleaner→client
    // cash + client→client discount) and, separately, the assigned cleaner (covers cleaner→cleaner
    // cash, capped at 3 jobs, + client→cleaner discount). Commission/discount accrues PENDING — the
    // wallet is NOT touched here. The monthly settlement cron (referralSettlement.ts) moves pending
    // rewards into the withdrawable balance at month end; the gap doubles as a clawback window.
    await step.run("referral-rewards", async () => {
      const [booking] = await db
        .select({ subtotalAmount: bookings.subtotalAmount })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      if (!booking?.subtotalAmount) return { skipped: "no_subtotal" }

      const [providerRow] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, providerId))

      const customerSide = await creditReferralReward({
        referredUserId: customerId,
        bookingId,
        subtotalCents: booking.subtotalAmount,
        isProviderSide: false,
      })

      const providerSide = providerRow?.userId && providerRow.userId !== customerId
        ? await creditReferralReward({
            referredUserId: providerRow.userId,
            bookingId,
            subtotalCents: booking.subtotalAmount,
            isProviderSide: true,
          })
        : { skipped: "provider_is_customer_or_unknown" }

      return { customerSide, providerSide }
    })

    await step.sleep("wait-24h", "24 hours")

    await step.run("review-reminder", async () => {
      const existing = await db.query.reviews.findMany({
        where: (r: any, { eq: eqFn }: any) => eqFn(r.bookingId, bookingId),
        limit: 1,
      })
      if (existing.length > 0) return { skipped: "already_reviewed" }

      const [freshUser] = await db
        .select({ email: users.email, deletedAt: users.deletedAt, locale: users.locale, emailReminders: users.emailReminders })
        .from(users)
        .where(eq(users.id, customerId))

      if (!freshUser || freshUser.deletedAt || !freshUser.email || !freshUser.emailReminders) return { skipped: "opted_out_or_deleted" }

      const { subject, html } = reviewReminderEmail(freshUser.locale, {
        reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}/review`,
      })
      await resend.emails.send({ from: FROM, to: freshUser.email, subject, html })
    })

    return { bookingId, amountCaptured: captureResult.amount_received }
  }
)
