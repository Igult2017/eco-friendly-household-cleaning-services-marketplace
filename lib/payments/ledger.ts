import { db } from "@/lib/db"
import { paymentEvents } from "@/lib/db/schema"

// One-liner for recording a real money movement in the append-only payment history. Never fails the
// caller — a ledger write that itself throws must not take down the payment flow it's recording.
//
// "priced" is the odd one out: it records a CALCULATION rather than a movement — the rate, the
// hours, what the sum came to and what was actually charged. It lives here because this is already
// the one place that answers "what happened to this booking's money", and a price nobody can check
// is how repeat cleanings quietly charged a single hour for months.
export async function recordPaymentEvent(event: {
  bookingId?: string | null
  userId?: string | null
  kind: "authorized" | "captured" | "refunded" | "transferred" | "payout_succeeded" | "payout_failed" | "priced"
  amountCents: number
  stripeObjectId?: string | null
  status: string
  metadata?: Record<string, string>
}) {
  try {
    await db.insert(paymentEvents).values(event)
  } catch (err) {
    console.error("[payments/ledger] failed to record event:", err)
  }
}
