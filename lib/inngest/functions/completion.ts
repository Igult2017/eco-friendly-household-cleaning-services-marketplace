import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, payments, users, notifications, providers, providerServices, recurringSchedules, paymentEvents } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { resend, FROM } from "@/lib/resend/client"
import { reviewRequestEmail, reviewReminderEmail, recurringDiscountEmail, paymentReceiptEmail } from "@/lib/resend/transactionalEmails"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { eq, and, sql } from "drizzle-orm"
import { creditReferralReward } from "@/lib/referrals/rewards"
import { getRecurringDiscountPct } from "@/lib/platform/settings"
import { recordPaymentEvent } from "@/lib/payments/ledger"
import { alertAdmins } from "@/lib/notifications/adminAlert"
import { logError } from "@/lib/utils/logError"

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
        try {
          return await stripe.paymentIntents.create({
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
        } catch (err) {
          // Without this, a failed recharge here threw silently — the hourly capture sweeper
          // (sweeper.ts) keeps retrying forever, but nobody was ever told. Record every attempt;
          // alert admins only once per booking so a persistently bad card doesn't spam the inbox
          // every hour.
          const message = err instanceof Error ? err.message : "Recharge failed"
          void logError({
            message: "[completion.ts] lapsed-hold recharge failed", error: err,
            severity: "critical", context: { bookingId, paymentIntentId },
          })
          await recordPaymentEvent({
            bookingId, userId: customerId, kind: "payout_failed", amountCents: pi.amount - penalty,
            stripeObjectId: paymentIntentId, status: "failed", metadata: { reason: message },
          })
          const priorFailures = await db.select({ id: paymentEvents.id }).from(paymentEvents)
            .where(and(eq(paymentEvents.bookingId, bookingId), eq(paymentEvents.kind, "payout_failed")))
            .limit(2)
          if (priorFailures.length <= 1) {
            await alertAdmins(
              "⚠️ A booking's payment could not be recharged",
              `The 7-day card hold on booking ${bookingId} expired and the automatic re-charge failed: ${message}. The cleaner has not been paid. This will keep retrying hourly — check the customer's payment method.`,
              "/admin/payments/history",
            )
            // Only the customer can actually fix this (a genuinely bad card, or one that needs a
            // fresh 3D-Secure check) — send them to the same real on-session recovery page used for
            // a no-card booking. Once per booking, same reasoning as the admin alert above. Booking
            // status stays pending_capture (unchanged) — the sweeper picks up a successful re-pay.
            await db.insert(notifications).values({
              userId: customerId, type: "payment_received" as const,
              title: "Action needed: your cleaning payment couldn't be collected",
              body: "Your card hold for a completed cleaning expired and we couldn't automatically re-charge it. Please confirm your payment method so your cleaner can be paid.",
              link: `/bookings/${bookingId}/pay`,
              metadata: { variant: "capture_recharge_failed" },
            })
          }
          throw err // preserve existing behavior: step fails, sweeper.ts retries hourly
        }
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
      await recordPaymentEvent({
        bookingId, userId: customerId, kind: "captured",
        amountCents: captureResult.amount_received ?? captureResult.amount,
        stripeObjectId: captureResult.id, status: "succeeded",
      })
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

    // The receipt goes out the moment the money is actually taken. Read the booking back AFTER the
    // status/late-penalty updates above so the amount shown is exactly what was charged. Not gated on
    // emailReminders (unlike the review nudge below) — a receipt is a payment record, not a reminder.
    await step.run("email-customer-receipt", async () => {
      if (!customer?.email) return
      const [b] = await db
        .select({
          bookingNumber: bookings.bookingNumber,
          totalAmount: bookings.totalAmount,
          carbonOffsetAmount: bookings.carbonOffsetAmount,
          scheduledAt: bookings.scheduledAt,
          providerCountry: providers.country,
          serviceName: providerServices.name,
        })
        .from(bookings)
        .leftJoin(providers, eq(bookings.providerId, providers.id))
        .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
        .where(eq(bookings.id, bookingId))
      if (!b) return
      const locale = customer.locale ?? "en"
      const { subject, html } = paymentReceiptEmail(customer.locale, {
        name: customer.firstName,
        number: b.bookingNumber,
        service: b.serviceName ?? "Cleaning",
        date: new Date(b.scheduledAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
        total: formatCurrencyForCountry(b.totalAmount + (b.carbonOffsetAmount ?? 0), b.providerCountry ?? "DE"),
        receiptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}/receipt`,
      })
      await resend.emails.send({ from: FROM, to: customer.email, subject, html })
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

    // If the client said they want recurring cleaning on this booking and hasn't already set up a
    // real schedule with this cleaner, nudge them once (in-app + email) toward /recurring/new with
    // the current admin-set discount rate — the wizard's "recurring" checkbox is just stated intent
    // until a schedule exists (see [[project_recurring]]).
    await step.run("recurring-discount-nudge", async () => {
      const [bk] = await db
        .select({ requestedFrequency: bookings.requestedFrequency, providerId: bookings.providerId })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      if (!bk?.requestedFrequency) return { skipped: "no_recurring_interest" }

      const [existingSchedule] = await db
        .select({ id: recurringSchedules.id })
        .from(recurringSchedules)
        .where(and(
          eq(recurringSchedules.customerId, customerId),
          eq(recurringSchedules.providerId, bk.providerId),
          eq(recurringSchedules.status, "active"),
        ))
        .limit(1)
      if (existingSchedule) return { skipped: "schedule_already_exists" }

      const pct = await getRecurringDiscountPct()
      if (pct <= 0) return { skipped: "no_discount_configured" }

      await db.insert(notifications).values({
        userId: customerId,
        type: "recurring_booking_created",
        title: `Save ${pct}% on your next 2 cleanings`,
        body: `You wanted recurring cleaning — set up a repeat schedule now and get ${pct}% off your 2nd and 3rd cleaning, automatically, on us.`,
        link: `/recurring/new?bookingId=${bookingId}`,
        metadata: { variant: "recurring_discount_available", pct: String(pct) },
      })

      if (customer?.email && customer.emailReminders) {
        const { subject, html } = recurringDiscountEmail(customer.locale, {
          name: customer.firstName,
          pct,
          setupUrl: `${process.env.NEXT_PUBLIC_APP_URL}/recurring/new?bookingId=${bookingId}`,
        })
        await resend.emails.send({ from: FROM, to: customer.email, subject, html })
      }

      return { notified: true, pct }
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
