import { db } from "@/lib/db"
import { referrals, referralCommissions, users } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { getReferralPct, getCleanerPeerReferralPct, getClientReferralDiscountPct } from "@/lib/platform/settings"

export const CLEANER_PEER_REFERRAL_CAP = 3

export type ReferralRewardResult =
  | { skipped: string }
  | { commissionCents: number; referrerId: string; rewardType: "commission" | "discount" }

// Credits a referral reward for ONE side of a completed booking — the referred person's own
// natural transaction on it (a client's booking-as-customer, or a cleaner's job-as-provider).
// Reward TYPE is decided by the REFERRER's role: cleaners earn cash commission (settled monthly,
// paid out via Stripe transfer — see referralSettlement.ts); everyone else earns a discount credit
// (spendable at checkout or withdrawable). Both land in the same referral_credits wallet; which one
// a given balance is is re-derived from the holder's role at read/payout time, not stored per-row.
// Cleaner→cleaner commissions stop after the invited cleaner's first 3 completed jobs
// (referrals.qualifyingOrdersCount); every other pairing (cleaner→client, client→anyone) is uncapped.
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

  const [referrer] = await db.select({ role: users.role }).from(users).where(eq(users.id, ref.referrerId))
  const isCleanerReferrer = referrer?.role === "provider"
  const rewardType: "commission" | "discount" = isCleanerReferrer ? "commission" : "discount"
  // Only a cleaner referring a cleaner (provider-side trigger + cleaner referrer) is capped and
  // uses the separate peer rate — cleaner→client and client→anyone stay uncapped.
  const isCleanerPeerReferral = isProviderSide && isCleanerReferrer

  if (isCleanerPeerReferral && ref.qualifyingOrdersCount >= CLEANER_PEER_REFERRAL_CAP) {
    return { skipped: "cleaner_peer_cap_reached" }
  }

  const pct = isCleanerPeerReferral
    ? await getCleanerPeerReferralPct()
    : isCleanerReferrer
      ? await getReferralPct()
      : await getClientReferralDiscountPct()

  const rewardCents = Math.round(subtotalCents * pct / 100)

  // Claim the booking FIRST, then update the running totals — never the other way round.
  //
  // The unique (booking_id, referral_id) index makes this insert the idempotency guard: a second
  // attempt for the same booking inserts nothing and returns empty. This used to sit AFTER the
  // update below, which meant a retry added the reward to the referrer's total a second time while
  // the insert correctly refused the duplicate. That was reachable, not theoretical: booking-completed
  // runs with retries: 3 and calls this twice (customer side, then provider side) inside ONE step,
  // so a failure on the provider side re-ran the customer side and inflated its total again. It also
  // inflated qualifying_orders_count, which caps cleaner-to-cleaner rewards at 3 — so a retry could
  // quietly cut a cleaner's earnings off early.
  const inserted = await db
    .insert(referralCommissions)
    .values({
      referralId: ref.id,
      bookingId,
      referrerId: ref.referrerId,
      bookingAmountCents: subtotalCents,
      commissionCents: rewardCents,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: referralCommissions.id })

  if (!inserted.length) return { skipped: "already_credited" }

  await db
    .update(referrals)
    .set({
      ...(pendingRef ? { status: "active" as const, activatedAt: new Date() } : {}),
      totalCommissionEarnedCents: sql`total_commission_earned_cents + ${rewardCents}`,
      qualifyingOrdersCount: sql`qualifying_orders_count + ${isCleanerPeerReferral ? 1 : 0}`,
    })
    .where(eq(referrals.id, ref.id))

  return { commissionCents: rewardCents, referrerId: ref.referrerId, rewardType }
}
