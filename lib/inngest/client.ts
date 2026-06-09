import { Inngest } from "inngest"

export const inngest = new Inngest({
  id: "dorix",
  name: "DORIX",
  eventKey: process.env.INNGEST_EVENT_KEY,
})

// ── Typed event definitions ──────────────────────────────────
export type DorixEvents = {
  "booking/created": {
    data: { bookingId: string; customerId: string; providerId: string }
  }
  "booking/completed": {
    data: { bookingId: string; paymentIntentId: string; providerId: string; customerId: string }
  }
  "booking/cancelled": {
    data: { bookingId: string; cancelledBy: string; refundAmount: number }
  }
  "dispute/opened": {
    data: { disputeId: string; bookingId: string; openedBy: string }
  }
  "dispute/resolved": {
    data: { disputeId: string; outcome: "customer" | "provider"; refundAmount?: number }
  }
  "job/posted": {
    data: { jobPostId: string; customerId: string }
  }
  "job/expired": {
    data: { jobPostId: string }
  }
  "payout/weekly-run": {
    data: { periodStart: string; periodEnd: string }
  }
  "payout/process-provider": {
    data: { providerId: string; periodStart: string; periodEnd: string }
  }
  "provider/identity-verified": {
    data: { providerId: string }
  }
  "recurring/schedule.created": {
    data: { scheduleId: string }
  }
}
