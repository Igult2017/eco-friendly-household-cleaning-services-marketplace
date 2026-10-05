import { describe, it, expect, vi, beforeEach } from "vitest"

// Stripe is stubbed at the module boundary: these tests are about how we INTERPRET what Stripe says
// about a hold, which is exactly where the "Internal server error" on cancel came from — the code
// never asked Stripe at all and trusted a stale copy in our own database instead.
const retrieve = vi.fn()
vi.mock("@/lib/stripe/client", () => ({
  stripe: { paymentIntents: { retrieve: (...a: unknown[]) => retrieve(...a) } },
  PLATFORM_FEE_PERCENT: 15,
}))

const { resolveHold, blockingReason, describeHoldOutcome } = await import("@/lib/stripe/resolveHold")

beforeEach(() => { retrieve.mockReset() })

describe("resolveHold — what the card hold is actually doing", () => {
  it("'live' when the money is still held and can be taken or released", async () => {
    retrieve.mockResolvedValue({ id: "pi_1", status: "requires_capture" })
    expect((await resolveHold("pi_1")).state).toBe("live")
  })

  it("'collected' when the money has already been taken", async () => {
    retrieve.mockResolvedValue({ id: "pi_1", status: "succeeded" })
    expect((await resolveHold("pi_1")).state).toBe("collected")
  })

  // The case that caused the bug: Stripe releases an uncaptured hold by itself after ~7 days, our
  // payments.status still reads "authorized", and the old code tried to capture/cancel a dead intent.
  it("'released' when Stripe has already let the hold lapse", async () => {
    retrieve.mockResolvedValue({ id: "pi_1", status: "canceled" })
    expect((await resolveHold("pi_1")).state).toBe("released")
  })

  it.each(["requires_payment_method", "requires_confirmation", "requires_action", "processing"])(
    "'unpaid' when the hold never completed (%s)",
    async (status) => {
      retrieve.mockResolvedValue({ id: "pi_1", status })
      expect((await resolveHold("pi_1")).state).toBe("unpaid")
    },
  )

  it("'unknown' — never throws — when Stripe cannot be reached", async () => {
    retrieve.mockImplementation(() => { throw new Error("connection reset") })
    const r = await resolveHold("pi_1")
    expect(r.state).toBe("unknown")
    expect(r.error).toContain("connection reset")
  })

  it("'unknown' when there is no payment intent id at all, without calling Stripe", async () => {
    expect((await resolveHold(null)).state).toBe("unknown")
    expect((await resolveHold(undefined)).state).toBe("unknown")
    expect((await resolveHold("")).state).toBe("unknown")
    expect(retrieve).not.toHaveBeenCalled()
  })
})

describe("blockingReason — only an unreadable payment may stop a cancellation", () => {
  // The whole point of the fix: a cancellation must never dead-end because the money side is
  // unusual. A lapsed hold means nothing to refund, not "you may not cancel".
  it.each(["live", "collected", "released", "unpaid"] as const)("does not block on '%s'", (state) => {
    expect(blockingReason({ state, intent: null })).toBeNull()
  })

  it("blocks only when we could not find out, and says nothing was charged", () => {
    const msg = blockingReason({ state: "unknown", intent: null, error: "timeout" })
    expect(msg).toBeTruthy()
    expect(msg).toContain("Nothing has been charged")
    expect(msg).toContain("timeout")
  })
})

describe("describeHoldOutcome — plain words for the person who clicked", () => {
  it("tells a client with a lapsed hold that they were not charged", () => {
    expect(describeHoldOutcome("released")).toContain("nothing was charged")
  })

  it("never returns the old catch-all phrasing", () => {
    for (const s of ["live", "collected", "released", "unpaid", "unknown"] as const) {
      expect(describeHoldOutcome(s)).not.toMatch(/internal server error/i)
    }
  })
})
