import { db } from "@/lib/db"
import { referrals, referralCommissions, users } from "@/lib/db/schema"
import { and, eq, gt, sql, count } from "drizzle-orm"
import { getReferralRewardCents, getReferralJobsRequired, getAffiliateCommissionPct } from "@/lib/platform/settings"

export type ReferralRewardResult =
  | { skipped: string; jobsSoFar?: number; jobsRequired?: number }
  | { commissionCents: number; referrerId: string; rewardType: "commission" | "discount" }

/**
 * Credit the referral reward for ONE side of a completed booking — the referred person's own
 * transaction on it (a client's booking-as-customer, or a cleaner's job-as-provider).
 *
 * ONE FLAT REWARD, PAID ONCE. The referrer earns a fixed amount (default €25) the first time the
 * person they invited reaches the agreed number of completed jobs:
 *
 *   - invited a CLEANER → paid after that cleaner's 2nd completed job
 *   - invited a CLIENT  → paid after that client's 1st completed booking
 *
 * It is not a percentage of the booking and it is not paid again on later bookings. (It used to be
 * a percentage of every booking subtotal, ongoing — three different rates for three pairings.)
 *
 * Reward TYPE is still decided by the REFERRER's role: cleaners earn cash commission (settled
 * monthly, paid out by transfer — see referralSettlement.ts); everyone else earns a discount credit
 * (spendable at checkout or withdrawable). Both land in the same referral_credits wallet; which one
 * a balance is is re-derived from the holder's role at read/payout time, not stored per row.
 */
export async function creditReferralReward(params: {
  referredUserId: string
  bookingId: string
  subtotalCents: number
  isProviderSide: boolean
}): Promise<ReferralRewardResult> {
  const { referredUserId, bookingId, subtotalCents, isProviderSide } = params

  const [pendingRef] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredId, referredUserId), eq(referrals.status, "pending")))
    .limit(1)

  const [activeRef] = !pendingRef
    ? await db
        .select()
        .from(referrals)
        .where(and(eq(referrals.referredId, referredUserId), eq(referrals.status, "active")))
        .limit(1)
    : [undefined]

  const ref = pendingRef ?? activeRef
  if (!ref) return { skipped: "no_referral" }

  // Claim this booking FIRST, with a zero-value row. The unique (booking_id, referral_id) index makes
  // this insert the idempotency guard: a retry inserts nothing and returns empty, so the same booking
  // can never be counted towards the threshold twice. booking-completed runs with retries: 3 and calls
  // this once per side inside ONE step, so a failure on the provider side re-runs the customer side —
  // that is a real path, not a theoretical one.
  const claimed = await db
    .insert(referralCommissions)
    .values({
      referralId: ref.id,
      bookingId,
      referrerId: ref.referrerId,
      bookingAmountCents: subtotalCents,
      commissionCents: 0,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: referralCommissions.id })

  if (!claimed.length) return { skipped: "already_counted" }

  const [referrer] = await db.select({ role: users.role }).from(users).where(eq(users.id, ref.referrerId))

  // AFFILIATES are a separate programme and keep the percentage model: a share of EVERY booking,
  // ongoing, for as long as the person they introduced keeps booking. That is exactly what the
  // public /affiliate page sells ("lifetime commission, no cap, no expiry"), so paying them a
  // one-off flat reward instead would make that page untrue.
  if (referrer?.role === "affiliate") {
    const pct = await getAffiliateCommissionPct()
    const affiliateCents = Math.round(subtotalCents * pct / 100)
    await db
      .update(referralCommissions)
      .set({ commissionCents: affiliateCents })
      .where(eq(referralCommissions.id, claimed[0].id))
    await db
      .update(referrals)
      .set({
        ...(pendingRef ? { status: "active" as const, activatedAt: new Date() } : {}),
        totalCommissionEarnedCents: sql`total_commission_earned_cents + ${affiliateCents}`,
      })
      .where(eq(referrals.id, ref.id))
    return { commissionCents: affiliateCents, referrerId: ref.referrerId, rewardType: "discount" }
  }

  // Already paid out? The reward is once per referral, so a later booking must not pay it again.
  const [{ paid }] = await db
    .select({ paid: count() })
    .from(referralCommissions)
    .where(and(eq(referralCommissions.referralId, ref.id), gt(referralCommissions.commissionCents, 0)))
  if (Number(paid) > 0) return { skipped: "reward_already_paid" }

  // How many of the invited person's jobs have now completed (each has exactly one claimed row).
  const [{ jobs }] = await db
    .select({ jobs: count() })
    .from(referralCommissions)
    .where(eq(referralCommissions.referralId, ref.id))
  const jobsSoFar = Number(jobs)

  const jobsRequired = await getReferralJobsRequired(isProviderSide)
  if (jobsSoFar < jobsRequired) {
    // Counted, not yet earned. Activating the referral here means the referrer can see it is live.
    if (pendingRef) {
      await db.update(referrals).set({ status: "active", activatedAt: new Date() }).where(eq(referrals.id, ref.id))
    }
    await db.update(referrals).set({ qualifyingOrdersCount: jobsSoFar }).where(eq(referrals.id, ref.id))
    return { skipped: "threshold_not_reached", jobsSoFar, jobsRequired }
  }

  const rewardType: "commission" | "discount" = referrer?.role === "provider" ? "commission" : "discount"
  const rewardCents = await getReferralRewardCents()

  await db
    .update(referralCommissions)
    .set({ commissionCents: rewardCents })
    .where(eq(referralCommissions.id, claimed[0].id))

  await db
    .update(referrals)
    .set({
      ...(pendingRef ? { status: "active" as const, activatedAt: new Date() } : {}),
      totalCommissionEarnedCents: sql`total_commission_earned_cents + ${rewardCents}`,
      qualifyingOrdersCount: jobsSoFar,
    })
    .where(eq(referrals.id, ref.id))

  return { commissionCents: rewardCents, referrerId: ref.referrerId, rewardType }
}
