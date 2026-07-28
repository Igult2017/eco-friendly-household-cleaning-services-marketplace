import { db } from "@/lib/db"
import { referralCommissions, referralCredits, referrals } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"

// Reverse credited/pending referral rewards when a booking's money is refunded — otherwise
// refund + kept reward is a money pump (book → complete → refund → referrer keeps the reward).
// A booking can now credit up to TWO independent reward rows (customer-side + provider-side — see
// lib/referrals/rewards.ts), so every matching row must be reversed, not just the first found.
// Idempotent: the credited→cancelled flip gates the wallet decrement, so retries are safe.
export async function clawbackReferralCommission(bookingId: string): Promise<void> {
  try {
    // Pending (not yet month-end-settled): cancel — no wallet was ever credited, so only the
    // referral's running "earned" figure needs restating.
    const pending = await db
      .update(referralCommissions)
      .set({ status: "cancelled" })
      .where(and(eq(referralCommissions.bookingId, bookingId), eq(referralCommissions.status, "pending")))
      .returning({ cents: referralCommissions.commissionCents, referralId: referralCommissions.referralId })
    for (const row of pending) {
      await db
        .update(referrals)
        .set({ totalCommissionEarnedCents: sql`GREATEST(total_commission_earned_cents - ${row.cents}, 0)` })
        .where(eq(referrals.id, row.referralId))
    }

    // Already settled into the wallet: reverse each row's referrer wallet + referral total.
    const credited = await db
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
      await db
        .update(referralCredits)
        .set({
          balanceCents: sql`GREATEST(referral_credits.balance_cents - ${c.cents}, 0)`,
          lifetimeEarnedCents: sql`GREATEST(referral_credits.lifetime_earned_cents - ${c.cents}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(referralCredits.userId, c.referrerId))
      await db
        .update(referrals)
        .set({ totalCommissionEarnedCents: sql`GREATEST(total_commission_earned_cents - ${c.cents}, 0)` })
        .where(eq(referrals.id, c.referralId))
    }
  } catch (e) {
    console.warn("[referrals] commission clawback failed (booking " + bookingId + "):", e)
  }
}
