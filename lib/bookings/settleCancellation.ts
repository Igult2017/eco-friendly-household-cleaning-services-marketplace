import { stripe } from "@/lib/stripe/client"
import { resolveHold, blockingReason, type HoldState } from "@/lib/stripe/resolveHold"
import { clawbackReferralCommission } from "@/lib/referrals/clawback"
import { logError } from "@/lib/utils/logError"

export type SettlementInput = {
  bookingId: string
  paymentIntentId: string
  /** Money to KEEP from the client's hold (cents). 0 on a free cancellation. */
  feeAmount: number
  /** Flat compensation paid straight to the cleaner on a very late cancellation (cents). */
  travelComp: number
  /** Whole hold incl. the carbon offset (cents) — what was authorized in the first place. */
  fullHold: number
  /** The booking's own commission rate, so a captured fee is split like a normal job would be. */
  platformFeePercent: number
  userId: string
}

export type Settlement = {
  ok: true
  holdState: HoldState
  paymentStatus: "cancelled" | "refunded" | "partially_refunded" | "captured"
  capturedFee: number
  capturedTravelComp: number
  feeCommission: number
} | {
  ok: false
  /** Plain-English, safe to show the person who clicked. */
  error: string
  status: 502 | 503
}

/**
 * Move (or decline to move) the money for a cancellation, and say what happened.
 *
 * The rule this enforces: ask Stripe what the hold is ACTUALLY doing before touching it. Our own
 * payments.status is a mirror that goes stale — Stripe releases an uncaptured hold by itself after
 * ~7 days without telling us — and acting on the stale value is what made cancelling a past-dated
 * booking impossible, with every failure surfacing as a bare "Internal server error".
 *
 * Never throws: every failure comes back as { ok: false } with a message worth reading.
 */
export async function settleCancellation(input: SettlementInput): Promise<Settlement> {
  const { bookingId, paymentIntentId, feeAmount, travelComp, fullHold, platformFeePercent, userId } = input

  const hold = await resolveHold(paymentIntentId)
  const blocked = blockingReason(hold)
  // Only a genuinely unreadable payment stops us — never guess about money. Every other state has a
  // safe answer below, because a cancellation must not dead-end on the state of the hold.
  if (blocked) return { ok: false, error: blocked, status: 503 }

  const base = { ok: true as const, holdState: hold.state, capturedFee: 0, capturedTravelComp: 0, feeCommission: 0 }

  try {
    // Idempotency keys: a retry after a partial failure must NOT charge / release twice (BUG-004).
    if (hold.state === "live") {
      if (feeAmount > 0 || travelComp > 0) {
        // Late cancel: capture the fee + any travel comp (Stripe releases the rest of the hold, incl.
        // the carbon offset). The fee is split like a normal job — the platform keeps its commission
        // and the cleaner is compensated for the slot; travel comp passes through in full.
        const feeCommission = Math.round(feeAmount * platformFeePercent / 100)
        await stripe.paymentIntents.capture(paymentIntentId, {
          amount_to_capture: feeAmount + travelComp,
          application_fee_amount: feeCommission,
        }, { idempotencyKey: `cancel-fee-${bookingId}` })
        return { ...base, paymentStatus: "captured", capturedFee: feeAmount, capturedTravelComp: travelComp, feeCommission }
      }
      // Free cancellation (early, or cleaner-initiated) → release the entire hold.
      await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `cancel-${bookingId}` })
      return { ...base, paymentStatus: "cancelled" }
    }

    if (hold.state === "collected") {
      // The money was already taken — refund the refundable portion incl. the offset.
      const refundCents = Math.max(0, fullHold - feeAmount)
      if (refundCents > 0) {
        await stripe.refunds.create(
          { payment_intent: paymentIntentId, amount: refundCents },
          { idempotencyKey: `refund-${bookingId}` },
        )
        // Refunded booking → its referral commission (if any was credited) is reversed.
        await clawbackReferralCommission(bookingId)
      }
      return {
        ...base,
        paymentStatus: refundCents >= fullHold ? "refunded" : "partially_refunded",
        capturedFee: feeAmount,
      }
    }

    if (hold.state === "unpaid") {
      // Nothing was ever held. Tidy the intent away so it can't settle later against a booking that
      // no longer exists; if Stripe won't cancel it, that is not worth failing the cancellation on.
      await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `cancel-${bookingId}` }).catch(() => undefined)
      return { ...base, paymentStatus: "cancelled" }
    }

    // "released" — the hold lapsed or was already cancelled. Nothing to take, nothing to give back,
    // the client was never charged. The booking still cancels; this used to throw and leave it stuck.
    return { ...base, paymentStatus: "cancelled" }
  } catch (stripeErr) {
    // A money failure is NOT "Internal server error" — say which step failed and what it means, so
    // whoever clicked can tell "the card hold expired" from "our database is down".
    const detail = stripeErr instanceof Error ? stripeErr.message : "Unknown payment error"
    void logError({
      message: "[settleCancellation] Stripe call failed", error: stripeErr,
      route: "/api/bookings/[id]/cancel", severity: "error", userId,
      context: { bookingId, holdState: hold.state, feeAmount, travelComp },
    })
    return {
      ok: false,
      status: 502,
      error: `The booking could not be cancelled because its payment could not be settled: ${detail}. Nothing has been charged — please try again, or contact support if this keeps happening.`,
    }
  }
}
