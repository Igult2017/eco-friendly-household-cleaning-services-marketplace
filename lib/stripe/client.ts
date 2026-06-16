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
 * (see getCommissionPct); defaults to the env PLATFORM_FEE_PERCENT. */
export function calculateBookingAmounts(subtotalCents: number, pct: number = PLATFORM_FEE_PERCENT) {
  const platformFee = Math.round(subtotalCents * (pct / 100))
  const totalCharged = subtotalCents + platformFee
  const providerPayout = subtotalCents // provider keeps 100% of their price
  return { subtotalCents, platformFee, totalCharged, providerPayout }
}
