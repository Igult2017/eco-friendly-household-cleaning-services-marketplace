import { db } from "@/lib/db"
import { platformSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PLATFORM_FEE_PERCENT } from "@/lib/stripe/client"

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
    const n = row ? parseInt(row.value, 10) : NaN
    if (!Number.isNaN(n) && n >= 1 && n <= 20) return n
  } catch {
    // table missing / DB error — fall through to the default
  }
  return 5
}
