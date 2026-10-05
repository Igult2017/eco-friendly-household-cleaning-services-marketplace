import { stripe } from "./client"
import type Stripe from "stripe"

// What a booking's card hold is ACTUALLY doing right now, asked of Stripe rather than inferred from
// our own payments.status column.
//
// Why this exists: a booking's money is a hold (a manual-capture PaymentIntent), and Stripe releases
// an uncaptured hold on its own after ~7 days. Nothing writes that back to us, so payments.status
// keeps saying "authorized" long after the hold is gone. Code that trusted that column then tried to
// capture or cancel a PaymentIntent Stripe had already cancelled, Stripe refused, and the whole
// request died — which is exactly how cancelling a past-dated booking became impossible.
//
// lib/inngest/functions/completion.ts already solved this for the capture path by retrieving the
// intent first; this is the same move, factored out so every caller gets it instead of one.
export type HoldState =
  | "live"      // requires_capture — the money is held and can still be taken or released
  | "collected" // succeeded — already captured; only a refund can move it now
  | "released"  // canceled — the hold is gone (lapsed, or already cancelled). Nothing to take or release.
  | "unpaid"    // never reached a hold (requires_payment_method/confirmation/action, processing)
  | "unknown"   // Stripe could not be reached, or there is no intent id at all

export type ResolvedHold = {
  state: HoldState
  intent: Stripe.PaymentIntent | null
  /** Set only when state is "unknown" — the reason we could not find out. */
  error?: string
}

const LIVE: Stripe.PaymentIntent.Status[] = ["requires_capture"]
const UNPAID: Stripe.PaymentIntent.Status[] = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]

/**
 * Ask Stripe what this hold is really doing. Never throws: a Stripe outage returns "unknown" so the
 * caller can decide whether to proceed or stop, rather than collapsing into a blanket 500.
 */
export async function resolveHold(paymentIntentId: string | null | undefined): Promise<ResolvedHold> {
  if (!paymentIntentId) return { state: "unknown", intent: null, error: "No payment intent on this booking" }

  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch (err) {
    return { state: "unknown", intent: null, error: err instanceof Error ? err.message : "Stripe lookup failed" }
  }

  if (LIVE.includes(intent.status)) return { state: "live", intent }
  if (intent.status === "succeeded") return { state: "collected", intent }
  if (intent.status === "canceled") return { state: "released", intent }
  if (UNPAID.includes(intent.status)) return { state: "unpaid", intent }
  return { state: "unknown", intent, error: `Unrecognised payment status "${intent.status}"` }
}

/**
 * The reason, in plain words, that we must NOT touch this booking's money right now.
 *
 * Only "unknown" blocks. Every other state has a safe answer, and a cancellation must never dead-end
 * just because the money side is unusual — "released" means there is nothing left to take or give
 * back, and "unpaid" means nothing was ever taken. Those are outcomes, not failures.
 */
export function blockingReason(resolved: ResolvedHold): string | null {
  if (resolved.state !== "unknown") return null
  return `We could not check this booking's payment with our payment provider${resolved.error ? ` (${resolved.error})` : ""}. Nothing has been charged. Please try again in a moment.`
}

/** Short, human sentence describing what happened to the money, for the response + audit trail. */
export function describeHoldOutcome(state: HoldState): string {
  switch (state) {
    case "live":      return "The payment hold was settled."
    case "collected":  return "The payment had already been taken, so it was refunded."
    case "released":   return "The payment hold had already expired, so nothing was charged."
    case "unpaid":     return "No payment had been taken for this booking."
    default:           return "The payment state could not be determined."
  }
}
