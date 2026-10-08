// Shared shape + validation for the admin settings page. Every number the admin can edit is held as
// a STRING while being typed (so a half-typed "4" isn't coerced to a number mid-keystroke) and only
// parsed on save.
export interface Config {
  commission_pct?:                 string
  commission_regular_pct?:         string
  commission_regular_after_jobs?:  string
  payout_schedule?:                string
  min_booking_minutes?:            string
  cancel_tier1_hours?:             string
  cancel_tier2_hours?:             string
  cancel_tier3_hours?:             string
  cancel_fee_low_pct?:             string
  cancel_fee_medium_pct?:          string
  cancel_fee_late_pct?:            string
  cancel_travel_comp_cents?:       string
  cancel_noshow_grace_minutes?:    string
  referral_reward_cents?:          string
  referral_cleaner_jobs_required?: string
  referral_client_jobs_required?:  string
  client_referral_discount_pct?:   string
  recurring_discount_pct?:         string
  min_hourly_rate_cents?:          string
}

export type SetFn = (key: keyof Config, val: string) => void

// Mirrors the server-side zod bounds in app/api/admin/settings/route.ts EXACTLY — checked here first
// so a mistyped or scroll-wheel-nudged value never has to make a round trip to find out it's
// rejected. If these two ever disagree, the looser one looks like it saved and then silently fails.
export const FIELD_BOUNDS: Record<string, { min: number; max: number; label: string }> = {
  commission_pct:                 { min: 0,  max: 60,      label: "Platform commission % (one-off)" },
  commission_regular_pct:         { min: 0,  max: 60,      label: "Platform commission % (regular client)" },
  commission_regular_after_jobs:  { min: 0,  max: 50,      label: "Jobs before the regular-client rate" },
  min_hourly_rate_cents:          { min: 0,  max: 100_000, label: "Minimum hourly rate" },
  referral_reward_cents:          { min: 0,  max: 100_000, label: "Referral reward" },
  referral_cleaner_jobs_required: { min: 1,  max: 20,      label: "Jobs a referred cleaner must complete" },
  referral_client_jobs_required:  { min: 1,  max: 20,      label: "Bookings a referred client must complete" },
  client_referral_discount_pct:   { min: 0,  max: 20,      label: "Affiliate commission %" },
  recurring_discount_pct:         { min: 0,  max: 50,      label: "Recurring booking discount %" },
  min_booking_minutes:            { min: 15, max: 480,     label: "Shortest booking (minutes)" },
  cancel_tier1_hours:             { min: 1,  max: 168,     label: "Free window (hours)" },
  cancel_tier2_hours:             { min: 1,  max: 168,     label: "Half-fee window (hours)" },
  cancel_tier3_hours:             { min: 0,  max: 168,     label: "Travel-comp window (hours)" },
  cancel_fee_low_pct:             { min: 0,  max: 100,     label: "Fee inside the free window %" },
  cancel_fee_medium_pct:          { min: 0,  max: 100,     label: "Fee inside 24h %" },
  cancel_fee_late_pct:            { min: 0,  max: 100,     label: "Fee in the last hours %" },
  cancel_travel_comp_cents:       { min: 0,  max: 50_000,  label: "Travel compensation" },
  cancel_noshow_grace_minutes:    { min: 0,  max: 120,     label: "No-show grace period" },
}

// Every numeric field that the admin can edit, in the order save() sends them.
export const NUMERIC_KEYS: (keyof Config)[] = [
  "commission_pct", "commission_regular_pct", "commission_regular_after_jobs",
  "min_booking_minutes", "min_hourly_rate_cents",
  "cancel_tier1_hours", "cancel_tier2_hours", "cancel_tier3_hours",
  "cancel_fee_low_pct", "cancel_fee_medium_pct", "cancel_fee_late_pct",
  "cancel_travel_comp_cents", "cancel_noshow_grace_minutes",
  "referral_reward_cents", "referral_cleaner_jobs_required", "referral_client_jobs_required",
  "client_referral_discount_pct", "recurring_discount_pct",
]

// Scrolling the page while the mouse happens to rest over a focused number field silently changes
// its value in most browsers — blurring on wheel stops that from ever happening.
export function blurOnWheel(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur()
}

export const INPUT_CLS =
  "h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"

/** Cents → "€12.34", for labels that must follow whatever is currently typed in the box. */
export function euros(cents: string | undefined, fallback: number): string {
  const n = parseInt(cents ?? String(fallback), 10)
  return `€${((Number.isNaN(n) ? fallback : n) / 100).toFixed(2)}`
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th". Used in the worked examples. */
export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"
  return `${n}${suffix}`
}
