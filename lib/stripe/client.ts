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
