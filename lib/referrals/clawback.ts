import { db } from "@/lib/db"
import { referralCommissions, referralCredits, referrals } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"
import { alertAdmins } from "@/lib/notifications/adminAlert"

// Reverse credited/pending referral rewards when a booking's money is refunded — otherwise
// refund + kept reward is a money pump (book → complete → refund → referrer keeps the reward).
// A booking can now credit up to TWO independent reward rows (customer-side + provider-side — see
// lib/referrals/rewards.ts), so every matching row must be reversed, not just the first found.
// Idempotent: the credited→cancelled flip gates the wallet decrement, so retries are safe.
export async function clawbackReferralCommission(bookingId: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      // Pending (not yet month-end-settled): cancel — no wallet was ever credited, so only the
      // referral's running "earned" figure needs restating.
      const pending = await tx
        .update(referralCommissions)
        .set({ status: "cancelled" })
        .where(and(eq(referralCommissions.bookingId, bookingId), eq(referralCommissions.status, "pending")))
        .returning({ cents: referralCommissions.commissionCents, referralId: referralCommissions.referralId })
      for (const row of pending) {
        await tx
          .update(referrals)
          .set({ totalCommissionEarnedCents: sql`GREATEST(total_commission_earned_cents - ${row.cents}, 0)` })
          .where(eq(referrals.id, row.referralId))
      }

      // Already settled into the wallet: reverse each row's referrer wallet + referral total.
      const credited = await tx
        .update(referralCommissions)
        .set({ status: "cancelled" })
        .where(and(eq(referralCommissions.bookingId, bookingId), eq(referralCommissions.status, "credited")))
        .returning({
          referrerId: referralCommissions.referrerId,
          cents: referralCommissions.commissionCents,
          referralId: referralCommissions.referralId,
        })
      for (const c of credited) {
        if (c.cents <= 0) continue
        // balanceCents is deliberately allowed to go NEGATIVE here (unlike the two stats fields
        // below, which are historical "earned" totals and stay floored at zero) — if the referrer
        // already withdrew this exact money via a real Stripe transfer before the refund/chargeback
        // happened, there's nothing left in their wallet to take back. Clamping to zero would just
        // absorb that loss silently. Going negative instead nets it against whatever they earn next,
        // and getOrCreateStripeCustomer-style "never silently lose track of real money" holds here too.
        const [updated] = await tx
          .update(referralCredits)
          .set({
            balanceCents: sql`referral_credits.balance_cents - ${c.cents}`,
            lifetimeEarnedCents: sql`GREATEST(referral_credits.lifetime_earned_cents - ${c.cents}, 0)`,
            updatedAt: new Date(),
          })
          .where(eq(referralCredits.userId, c.referrerId))
          .returning({ balanceCents: referralCredits.balanceCents })
        await tx
          .update(referrals)
          .set({ totalCommissionEarnedCents: sql`GREATEST(total_commission_earned_cents - ${c.cents}, 0)` })
          .where(eq(referrals.id, c.referralId))

        if (updated && updated.balanceCents < 0) {
          await alertAdmins(
            "A referral wallet went negative during a clawback",
            `Booking ${bookingId} was refunded/disputed, but the referrer (user ${c.referrerId}) had already withdrawn part or all of the ${(c.cents / 100).toFixed(2)} commission owed back. Their balance is now €${(updated.balanceCents / 100).toFixed(2)} and will net against future earnings — this is real money that may not be fully recoverable, worth a manual look.`,
            "/admin/referrals",
          )
        }
      }
    })
  } catch (e) {
    console.error("[referrals] commission clawback failed (booking " + bookingId + "):", e)
    void logError({
      message: "[referrals] commission clawback failed", error: e,
      severity: "critical", context: { bookingId },
    })
    await alertAdmins(
      "⚠️ A referral commission clawback failed entirely",
      `Booking ${bookingId} was refunded/disputed, but reversing its referral commission failed and was rolled back — nothing was reversed. This needs a manual check.`,
      "/admin/payments/history",
    )
  }
}
