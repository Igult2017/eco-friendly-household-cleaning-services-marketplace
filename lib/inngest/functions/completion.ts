import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, payments, users, notifications, referrals, referralCommissions, referralCredits } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { resend, FROM } from "@/lib/resend/client"
import { eq, and, sql } from "drizzle-orm"

const REFERRAL_COMMISSION_PCT = 0.05 // 5%

export const onBookingCompleted = inngest.createFunction(
  { id: "booking-completed", retries: 3, triggers: [{ event: "booking/completed" }] },
  async ({ event, step }: { event: { data: { bookingId: string; paymentIntentId: string; providerId: string; customerId: string } }; step: any }) => {
    const { bookingId, paymentIntentId, customerId } = event.data

    // Split capture and DB write into separate steps so a DB failure on retry
    // doesn't re-hit Stripe — the idempotency key ensures Stripe deduplicates.
    const captureResult = await step.run("stripe-capture", async () => {
      return stripe.paymentIntents.capture(
        paymentIntentId,
        {},
        { idempotencyKey: `capture-${paymentIntentId}` },
      )
    })

    await step.run("record-capture", async () => {
      await db
        .update(payments)
        .set({ status: "captured", capturedAmount: captureResult.amount_received, capturedAt: new Date() })
        .where(eq(payments.stripePaymentIntentId, paymentIntentId))
    })

    await step.run("update-booking", async () => {
      await db.update(bookings).set({ status: "completed" }).where(eq(bookings.id, bookingId))
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
      const [c] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, customerId))
      return c
    })

    await step.run("email-customer-review", async () => {
      if (!customer?.email) return
      await resend.emails.send({
        from: FROM,
        to: customer.email,
        subject: "How was your cleaning? Leave a review 🌿",
        html: `
          <h2>Your home is sparkling clean!</h2>
          <p>Hi ${customer.firstName ?? "there"},</p>
          <p>Your cleaning session has been completed and payment captured.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}/review" style="background:#2D7A5F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">Leave a Review</a>
          <p style="margin-top:24px;color:#6B7280;">Thank you for choosing DORIX 🌿</p>
        `,
      })
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

      const commissionCents = Math.round(booking.subtotalAmount * REFERRAL_COMMISSION_PCT)

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

      await db.insert(referralCommissions).values({
        referralId: ref.id,
        bookingId,
        referrerId: ref.referrerId,
        bookingAmountCents: booking.subtotalAmount,
        commissionCents,
        status: "credited",
        creditedAt: new Date(),
      })

      // Upsert credit wallet
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
        .select({ email: users.email, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, customerId))

      if (!freshUser || freshUser.deletedAt || !freshUser.email) return { skipped: "account_deleted" }

      await resend.emails.send({
        from: FROM,
        to: freshUser.email,
        subject: "Reminder: Share your DORIX experience",
        html: `<p>Just a friendly reminder to leave a review for your recent cleaning. <a href="${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}/review">Click here</a>.</p>`,
      })
    })

    return { bookingId, amountCaptured: captureResult.amount_received }
  }
)
