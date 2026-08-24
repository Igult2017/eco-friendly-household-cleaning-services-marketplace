import { db } from "@/lib/db"
import { paymentEvents } from "@/lib/db/schema"

// One-liner for recording a real money movement in the append-only payment history. Never fails the
// caller — a ledger write that itself throws must not take down the payment flow it's recording.
export async function recordPaymentEvent(event: {
  bookingId?: string | null
  userId?: string | null
  kind: "authorized" | "captured" | "refunded" | "transferred" | "payout_succeeded" | "payout_failed"
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
