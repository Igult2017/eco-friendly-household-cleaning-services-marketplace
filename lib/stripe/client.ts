import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
})

export const PLATFORM_FEE_PERCENT = parseInt(
  process.env.PLATFORM_FEE_PERCENT ?? "15",
  10
)

/** Calculate amounts from a subtotal (all values in euro cents) */
export function calculateBookingAmounts(subtotalCents: number) {
  const platformFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
  const totalCharged = subtotalCents + platformFee
  const providerPayout = subtotalCents // provider keeps 100% of their price
  return { subtotalCents, platformFee, totalCharged, providerPayout }
}
