import Stripe from "stripe"

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder_build_only",
  { apiVersion: "2026-05-27.dahlia", typescript: true }
)

export const PLATFORM_FEE_PERCENT = parseInt(
  process.env.PLATFORM_FEE_PERCENT ?? "15",
  10
)

/** Calculate amounts from a subtotal (all values in euro cents).
 * `pct` is the platform commission percent — pass the admin-configured value
 * (see getCommissionPct); defaults to the env PLATFORM_FEE_PERCENT.
 *
 * Marketplace model: the cleaner's rate IS what the customer pays. The platform
 * commission is DEDUCTED from the cleaner's payout (the cleaner "rents" the
 * platform to reach clients) — it is NOT added on top of the customer's price. */
export function calculateBookingAmounts(subtotalCents: number, pct: number = PLATFORM_FEE_PERCENT) {
  const platformFee = Math.round(subtotalCents * (pct / 100))
  const totalCharged = subtotalCents                 // customer pays the cleaner's rate
  const providerPayout = subtotalCents - platformFee // cleaner nets the rate minus commission
  return { subtotalCents, platformFee, totalCharged, providerPayout }
}

/** Like calculateBookingAmounts, but for a discount that must come ENTIRELY out of the platform's
 * own commission — never the cleaner's payout (e.g. the recurring-cleaning discount on a client's
 * 2nd/3rd cleaning). The cleaner is always paid exactly what they'd get on a full-price job of this
 * size; the discount is subtracted from platformFee instead, clamped so it can never push the fee
 * (or the customer's charge) below zero. subtotalCents stays the UNDISCOUNTED service price — it's
 * what the cleaner's payout is computed from — while totalCharged is the discounted amount the
 * customer actually pays. platformFee + providerPayout always sums back to totalCharged, which is
 * what a Stripe destination charge (application_fee_amount + implicit transfer) requires to balance. */
export function calculateDiscountedBookingAmounts(subtotalCents: number, commissionPct: number, discountPct: number) {
  const full = calculateBookingAmounts(subtotalCents, commissionPct)
  const rawDiscountCents = Math.round(subtotalCents * (discountPct / 100))
  const discountCents = Math.max(0, Math.min(rawDiscountCents, full.platformFee))
  return {
    subtotalCents,
    totalCharged: subtotalCents - discountCents,
    platformFee: full.platformFee - discountCents,
    providerPayout: full.providerPayout, // unchanged — the discount never reduces the cleaner's cut
    discountCents,
  }
}
