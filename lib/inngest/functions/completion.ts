import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, payments, users, notifications, providers, referrals, referralCommissions, referralCredits } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { resend, FROM } from "@/lib/resend/client"
import { reviewRequestEmail, reviewReminderEmail } from "@/lib/resend/transactionalEmails"
import { eq, and, sql } from "drizzle-orm"
import { getReferralPct } from "@/lib/platform/settings"

export const onBookingCompleted = inngest.createFunction(
  { id: "booking-completed", retries: 3, triggers: [{ event: "booking/completed" }] },
  async ({ event, step }: { event: { data: { bookingId: string; paymentIntentId: string; providerId: string; customerId: string } }; step: any }) => {
    const { bookingId, paymentIntentId, providerId, customerId } = event.data

    // Split capture and DB write into separate steps so a DB failure on retry
    // doesn't re-hit Stripe — the idempotency key ensures Stripe deduplicates.
    const captureResult = await step.run("stripe-capture", async () => {
      // Don't capture a card on a booking that was disputed/cancelled after /complete fired — the
      // dispute-open route allows opening a dispute while status is pending_capture. Re-check first.
      // (This event only fires once BOTH parties confirmed or an admin released — see complete/confirm.)
      const [bk] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId))
      if (!bk || bk.status !== "pending_capture") return null
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      // Normal path: the manual-capture hold is still alive → capture it.
      if (pi.status === "requires_capture") {
        return stripe.paymentIntents.capture(paymentIntentId, {}, { idempotencyKey: `capture-${paymentIntentId}` })
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
          amount: pi.amount,
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

    // Process referral commission — 5% of booking subtotal credited to referrer
    await step.run("referral-commission", async () => {
      const [booking] = await db
        .select({ subtotalAmount: bookings.subtotalAmount })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      if (!booking?.subtotalAmount) return { skipped: "no_subtotal" }

      const [referral] = await db
        .select()
        .from(referrals)
        .where(and(eq(referrals.referredId, customerId), eq(referrals.status, "pending")))
        .limit(1)

      // Also check already-active referrals for lifetime commissions
      const [activeReferral] = !referral
        ? await db
            .select()
            .from(referrals)
            .where(and(eq(referrals.referredId, customerId), eq(referrals.status, "active")))
            .limit(1)
        : [undefined]

      const ref = referral ?? activeReferral
      if (!ref) return { skipped: "no_referral" }

      // Use the admin-configured referral rate (was hardcoded 5%, ignoring the admin setting).
      const referralPct = await getReferralPct()
      const commissionCents = Math.round(booking.subtotalAmount * referralPct / 100)

      // Activate on first booking if still pending
      if (referral) {
        await db
          .update(referrals)
          .set({ status: "active", activatedAt: new Date(), totalCommissionEarnedCents: sql`total_commission_earned_cents + ${commissionCents}` })
          .where(eq(referrals.id, ref.id))
      } else {
        await db
          .update(referrals)
          .set({ totalCommissionEarnedCents: sql`total_commission_earned_cents + ${commissionCents}` })
          .where(eq(referrals.id, ref.id))
      }

      // Unique constraint on booking_id makes this INSERT idempotent across retries.
      // If it returns empty (conflict), a prior attempt already credited — skip wallet update.
      const inserted = await db
        .insert(referralCommissions)
        .values({
          referralId: ref.id,
          bookingId,
          referrerId: ref.referrerId,
          bookingAmountCents: booking.subtotalAmount,
          commissionCents,
          status: "credited",
          creditedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: referralCommissions.id })

      if (!inserted.length) return { skipped: "already_credited" }

      // Only reaches here once per booking — safe to increment balance
      await db
        .insert(referralCredits)
        .values({ userId: ref.referrerId, balanceCents: commissionCents, lifetimeEarnedCents: commissionCents })
        .onConflictDoUpdate({
          target: referralCredits.userId,
          set: {
            balanceCents: sql`referral_credits.balance_cents + ${commissionCents}`,
            lifetimeEarnedCents: sql`referral_credits.lifetime_earned_cents + ${commissionCents}`,
            updatedAt: new Date(),
          },
        })

      return { commissionCents, referrerId: ref.referrerId }
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
