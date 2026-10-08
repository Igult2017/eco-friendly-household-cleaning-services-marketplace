import { db } from "@/lib/db"
import { platformSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PLATFORM_FEE_PERCENT } from "@/lib/stripe/client"

// Generic helper: read one platform_settings row as an integer within [min,max], falling back to
// fallback if the row is missing, unparseable, or out of range. Mirrors getCommissionPct's pattern
// so every admin-configurable numeric setting behaves identically (live read, no cache, safe default).
async function getIntSetting(key: string, fallback: number, min: number, max: number): Promise<number> {
  try {
    const [row] = await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.key, key))
    if (row) {
      const n = parseInt(row.value, 10)
      if (!Number.isNaN(n) && n >= min && n <= max) return n
      console.warn(`[settings] ${key} "${row.value}" is invalid/out-of-range — using default ${fallback}`)
    }
  } catch {
    // table missing / DB error — fall through to the default
  }
  return fallback
}

// The admin-configurable commission %, read from platform_settings. Falls back
// to the PLATFORM_FEE_PERCENT env default if the row (or table) is absent or the
// value is out of range — so pricing never breaks if the setting isn't set yet.
export async function getCommissionPct(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, "commission_pct"))
    if (row) {
      const n = parseInt(row.value, 10)
      if (!Number.isNaN(n) && n >= 0 && n <= 60) return n
      // Row exists but is unparseable/out-of-range — fail LOUD so a typo'd setting (which would
      // silently apply the env default to every cleaner's payout) is diagnosable.
      console.warn(`[settings] commission_pct "${row.value}" is invalid/out-of-range — using default ${PLATFORM_FEE_PERCENT}%`)
    }
  } catch {
    // table missing / DB error — fall through to the env default
  }
  return PLATFORM_FEE_PERCENT
}

// The AFFILIATE commission % — the one referrer type still paid a share of every booking, ongoing,
// which is what the public /affiliate page advertises. Everyone else now earns a one-off flat reward
// (getReferralRewardCents). Credited to a spendable balance the holder can either apply as a
// discount at checkout OR withdraw as real cash — they have their own lightweight Connect payout
// account for it (users.referralPayoutAccountId, separate from a cleaner's job-payout account; see
// app/api/referrals/withdraw/route.ts, which has no role restriction).
// The key is still "client_referral_discount_pct" so existing installs keep their configured rate.
export async function getAffiliateCommissionPct(): Promise<number> {
  return getIntSetting("client_referral_discount_pct", 5, 0, 20)
}

// Admin-set recurring-booking discount %, replacing the old per-cleaner providers.recurringDiscountPct
// control — applies uniformly to every recurring occurrence regardless of which cleaner is assigned.
export async function getRecurringDiscountPct(): Promise<number> {
  return getIntSetting("recurring_discount_pct", 10, 0, 50)
}

// Admin-set minimum hourly wage floor, in cents. Applies to any hourly rate set on either side of
// the marketplace — a client's job-post rate and a cleaner's own per-hour service rate both
// determine what a cleaner ends up earning per hour, so both are checked against this same number.
// One flat figure for both the EUR and USD markets (no currency-aware setting exists anywhere in
// this app yet — see cancel_travel_comp_cents for the same precedent).
export async function getMinHourlyRateCents(): Promise<number> {
  return getIntSetting("min_hourly_rate_cents", 1800, 0, 100_000)
}

// The flat referral reward, in cents — paid ONCE per referral when the invited person reaches the
// job threshold below. Default 2500 (€25). Replaced the old per-booking percentage model.
export async function getReferralRewardCents(): Promise<number> {
  return getIntSetting("referral_reward_cents", 2500, 0, 100_000)
}

// How many completed jobs the invited person must reach before the reward is earned. A cleaner has
// to finish 2 jobs (so a sign-up that does one job and vanishes earns nothing); a client only has to
// complete 1 booking, since that is already a real, paid transaction.
export async function getReferralJobsRequired(isProviderSide: boolean): Promise<number> {
  return isProviderSide
    ? getIntSetting("referral_cleaner_jobs_required", 2, 1, 20)
    : getIntSetting("referral_client_jobs_required", 1, 1, 20)
}

// The reduced commission an ESTABLISHED regular client earns for their cleaner — see
// lib/platform/commissionTier.ts for which bookings qualify. The standard rate above still applies
// to one-offs and to a regular's first few jobs. Default 33% (the cleaner keeps 67%).
export async function getRegularClientCommissionPct(): Promise<number> {
  return getIntSetting("commission_regular_pct", 33, 0, 60)
}

// How many delivered jobs a client and cleaner must have together before the reduced rate kicks in.
// Default 3 — the 4th job onwards is charged the reduced rate.
export async function getRegularClientAfterJobs(): Promise<number> {
  return getIntSetting("commission_regular_after_jobs", 3, 0, 50)
}

// Admin-set shortest booking anyone can make, in minutes. Applies to BOTH ways work is arranged —
// booking a cleaner directly and posting a job for bids — so a client cannot route around it by
// using the other path. Default 120 (2 hours): shorter visits are not worth a cleaner's travel.
export async function getMinBookingMinutes(): Promise<number> {
  return getIntSetting("min_booking_minutes", 120, 15, 480)
}

// Admin-set hard cap on how far a cleaner can set their own service radius — enforced live in
// lib/validations/provider.ts and lib/validations/onboarding.ts (the zod schema's own ceiling is
// a generous static bound; this is the real, admin-adjustable one).
// NOTE: there is deliberately no getMaxServiceRadiusKm any more. A cleaner may set whatever service
// radius they like, so the admin cap (and the three server checks that read it) were removed rather
// than left as a control that changes nothing. The only bound left is the 20000 km technical
// ceiling in the zod schemas — half the Earth's circumference, so it already covers the planet; it
// exists purely so a typo'd number can't reach the distance maths in lib/db/queries/geo.ts.

// Admin-set default payout interval for NEWLY connected cleaner Stripe accounts (lib/stripe/connect.ts).
// Stripe supports "weekly" and "monthly" — NOT "biweekly" — so only those two are valid here.
export async function getPayoutSchedule(): Promise<"weekly" | "monthly"> {
  try {
    const [row] = await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.key, "payout_schedule"))
    if (!row) return "weekly"
    if (row.value === "weekly" || row.value === "monthly") return row.value
    console.warn(`[settings] payout_schedule "${row.value}" is invalid — using default "weekly"`)
  } catch {
    // table missing / DB error — fall through to the default
  }
  return "weekly"
}

export type CancellationConfig = {
  tier1Hours: number       // above this = full refund (0% fee)
  tier2Hours: number       // between tier2 and tier1 = "low" fee
  tier3Hours: number       // between tier3 and tier2 = "medium" fee; below tier3 = "late" fee
  feeLowPct: number
  feeMediumPct: number
  feeLatePct: number
  travelCompCents: number  // flat compensation added on top of the "late" tier fee
  noshowGraceMinutes: number
}

// All cancellation/no-show settings in one read, admin-configurable via /admin/settings. Live read,
// no caching — an admin change takes effect on the very next cancellation/no-show request.
export async function getCancellationConfig(): Promise<CancellationConfig> {
  const [tier1Hours, tier2Hours, tier3Hours, feeLowPct, feeMediumPct, feeLatePct, travelCompCents, noshowGraceMinutes] = await Promise.all([
    // Defaults express the agreed policy: free more than 48h ahead, half price inside 48h, full
    // price inside 24h. tier3/late keep the most extreme band (the cleaner may already be
    // travelling), which is the only band that also adds travel compensation.
    getIntSetting("cancel_tier1_hours", 48, 1, 168),
    getIntSetting("cancel_tier2_hours", 24, 1, 168),
    getIntSetting("cancel_tier3_hours", 2, 0, 168),
    getIntSetting("cancel_fee_low_pct", 50, 0, 100),
    getIntSetting("cancel_fee_medium_pct", 100, 0, 100),
    getIntSetting("cancel_fee_late_pct", 100, 0, 100),
    getIntSetting("cancel_travel_comp_cents", 500, 0, 50_000),
    getIntSetting("cancel_noshow_grace_minutes", 15, 0, 120),
  ])
  return { tier1Hours, tier2Hours, tier3Hours, feeLowPct, feeMediumPct, feeLatePct, travelCompCents, noshowGraceMinutes }
}
