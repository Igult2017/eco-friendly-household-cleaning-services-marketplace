import { stripe } from "./client"
import type Stripe from "stripe"

/** Verify and construct a Stripe webhook event. Throws on invalid signature. */
export function constructStripeEvent(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}
