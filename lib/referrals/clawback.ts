import { db } from "@/lib/db"
import { referralCommissions, referralCredits, referrals } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"

// Reverse a credited referral commission when the booking's money is refunded — otherwise
// refund + kept commission is a money pump (book → complete → refund → referrer keeps 5%).
// Idempotent: the credited→cancelled flip gates the wallet decrement, so retries are safe.
export async function clawbackReferralCommission(bookingId: string): Promise<void> {
  try {
    // Pending (not yet month-end-settled): cancel it — no wallet was ever credited, so only the
    // referral's running "earned" figure needs restating.
    const pending = await db
      .update(referralCommissions)
      .set({ status: "cancelled" })
      .where(and(eq(referralCommissions.bookingId, bookingId), eq(referralCommissions.status, "pending")))
      .returning({ cents: referralCommissions.commissionCents, referralId: referralCommissions.referralId })
    if (pending[0]) {
      await db
        .update(referrals)
        .set({ totalCommissionEarnedCents: sql`GREATEST(total_commission_earned_cents - ${pending[0].cents}, 0)` })
        .where(eq(referrals.id, pending[0].referralId))
      return
    }

    const updated = await db
      .update(referralCommissions)
      .set({ status: "cancelled" })
      .where(and(eq(referralCommissions.bookingId, bookingId), eq(referralCommissions.status, "credited")))
      .returning({
        referrerId: referralCommissions.referrerId,
        cents: referralCommissions.commissionCents,
        referralId: referralCommissions.referralId,
      })
    const c = updated[0]
    if (!c || c.cents <= 0) return

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
  } catch (e) {
    console.warn("[referrals] commission clawback failed (booking " + bookingId + "):", e)
  }
}
