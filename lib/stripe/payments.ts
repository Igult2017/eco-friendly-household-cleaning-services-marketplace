import { stripe, calculateBookingAmounts } from "./client"

/** Create a pre-authorized PaymentIntent (not yet captured) */
export async function createBookingPaymentIntent(params: {
  subtotalCents: number
  stripeCustomerId: string
  providerStripeAccountId: string
  bookingMetadata: Record<string, string>
  idempotencyKey: string
}) {
  const { subtotalCents, platformFee, totalCharged } =
    calculateBookingAmounts(params.subtotalCents)

  return stripe.paymentIntents.create(
    {
      amount: totalCharged,
      currency: "eur",
      capture_method: "manual", // pre-auth only — captured after job completion
      customer: params.stripeCustomerId,
      application_fee_amount: platformFee,
      transfer_data: { destination: params.providerStripeAccountId },
      metadata: params.bookingMetadata,
    },
    { idempotencyKey: params.idempotencyKey }
  )
}

/** Capture a pre-authorized PaymentIntent after job completion */
export async function capturePaymentIntent(
  paymentIntentId: string,
  idempotencyKey: string
) {
  return stripe.paymentIntents.capture(
    paymentIntentId,
    {},
    { idempotencyKey }
  )
}

/** Issue a full or partial refund */
export async function refundPayment(params: {
  paymentIntentId: string
  amountCents?: number // omit for full refund
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
  idempotencyKey: string
}) {
  return stripe.refunds.create(
    {
      payment_intent: params.paymentIntentId,
      ...(params.amountCents ? { amount: params.amountCents } : {}),
      reason: params.reason ?? "requested_by_customer",
    },
    { idempotencyKey: params.idempotencyKey }
  )
}

/** Cancel a PaymentIntent that was never captured (releases the hold) */
export async function cancelPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId)
}
