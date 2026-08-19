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
      if (!Number.isNaN(n) && n >= 0 && n <= 50) return n
      // Row exists but is unparseable/out-of-range — fail LOUD so a typo'd setting (which would
      // silently apply the env default to every cleaner's payout) is diagnosable.
      console.warn(`[settings] commission_pct "${row.value}" is invalid/out-of-range — using default ${PLATFORM_FEE_PERCENT}%`)
    }
  } catch {
    // table missing / DB error — fall through to the env default
  }
  return PLATFORM_FEE_PERCENT
}

// The admin-configurable affiliate/referral commission % (what a referrer earns per booking),
// read from platform_settings. Separate from the platform commission above. Defaults to 5.
export async function getReferralPct(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, "referral_pct"))
    if (row) {
      const n = parseInt(row.value, 10)
      if (!Number.isNaN(n) && n >= 0 && n <= 20) return n
      console.warn(`[settings] referral_pct "${row.value}" is invalid/out-of-range — using default 5%`)
    }
  } catch {
    // table missing / DB error — fall through to the default
  }
  return 5
}

// Cleaner→cleaner referral commission % — paid on the invited cleaner's first 3 completed jobs
// only (see referrals.qualifyingOrdersCount). Separate rate from the general referral_pct above.
export async function getCleanerPeerReferralPct(): Promise<number> {
  return getIntSetting("cleaner_peer_referral_pct", 10, 0, 20)
}

// Client referral reward %, credited as a spendable/withdrawable discount balance rather than
// cash (clients don't have Connect job payouts) — applies whether the invited person is a client
// or a cleaner (based on the OTHER party's own booking-as-customer / job-as-provider).
export async function getClientReferralDiscountPct(): Promise<number> {
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
  return getIntSetting("min_hourly_rate_cents", 1500, 0, 100_000)
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
    getIntSetting("cancel_tier1_hours", 24, 1, 168),
    getIntSetting("cancel_tier2_hours", 6, 1, 168),
    getIntSetting("cancel_tier3_hours", 2, 0, 168),
    getIntSetting("cancel_fee_low_pct", 10, 0, 100),
    getIntSetting("cancel_fee_medium_pct", 30, 0, 100),
    getIntSetting("cancel_fee_late_pct", 100, 0, 100),
    getIntSetting("cancel_travel_comp_cents", 500, 0, 50_000),
    getIntSetting("cancel_noshow_grace_minutes", 15, 0, 120),
  ])
  return { tier1Hours, tier2Hours, tier3Hours, feeLowPct, feeMediumPct, feeLatePct, travelCompCents, noshowGraceMinutes }
}
