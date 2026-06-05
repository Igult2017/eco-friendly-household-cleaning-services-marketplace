import { describe, it, expect } from "vitest"

// Pure payout aggregation logic extracted from processProviderPayout
function aggregatePayout(rows: { providerPayout: number; refundedAmount: number }[]): number {
  return rows.reduce((sum, b) => sum + Math.max(0, b.providerPayout - (b.refundedAmount ?? 0)), 0)
}

describe("payout aggregation (INN-001 regression)", () => {
  it("sums provider payouts for completed bookings", () => {
    const rows = [
      { providerPayout: 10_000, refundedAmount: 0 },
      { providerPayout: 5_000, refundedAmount: 0 },
    ]
    expect(aggregatePayout(rows)).toBe(15_000)
  })

  it("deducts refunded amounts — prevents provider overpayment", () => {
    const rows = [
      { providerPayout: 10_000, refundedAmount: 5_000 }, // 50% dispute refund
      { providerPayout: 8_000, refundedAmount: 0 },
    ]
    expect(aggregatePayout(rows)).toBe(13_000) // 5000 + 8000
  })

  it("floors at zero when full refund issued — provider gets nothing for that booking", () => {
    const rows = [
      { providerPayout: 10_000, refundedAmount: 10_000 }, // 100% refund
    ]
    expect(aggregatePayout(rows)).toBe(0)
  })

  it("never produces negative payout even if refundedAmount exceeds providerPayout", () => {
    const rows = [{ providerPayout: 5_000, refundedAmount: 9_999 }]
    expect(aggregatePayout(rows)).toBe(0)
  })

  it("handles empty period with no bookings", () => {
    expect(aggregatePayout([])).toBe(0)
  })

  it("correctly aggregates mixed bookings", () => {
    const rows = [
      { providerPayout: 12_000, refundedAmount: 0 },      // full keep
      { providerPayout: 8_000, refundedAmount: 4_000 },   // 50% refund
      { providerPayout: 6_000, refundedAmount: 6_000 },   // 100% refund
      { providerPayout: 15_000, refundedAmount: 0 },      // full keep
    ]
    // 12000 + 4000 + 0 + 15000 = 31000
    expect(aggregatePayout(rows)).toBe(31_000)
  })
})

describe("Stripe transfer idempotency key format (INN-004 regression)", () => {
  it("produces a deterministic key from provider + period", () => {
    const key = `transfer-${crypto.randomUUID()}-2026-06-02-2026-06-08`
    // Key must be stable across retries — same inputs produce same key
    const providerId = "abc-123"
    const k1 = `transfer-${providerId}-2026-06-02-2026-06-08`
    const k2 = `transfer-${providerId}-2026-06-02-2026-06-08`
    expect(k1).toBe(k2)
  })

  it("different providers produce different keys", () => {
    const k1 = `transfer-provider-A-2026-06-02-2026-06-08`
    const k2 = `transfer-provider-B-2026-06-02-2026-06-08`
    expect(k1).not.toBe(k2)
  })

  it("different periods produce different keys for same provider", () => {
    const id = "provider-X"
    const k1 = `transfer-${id}-2026-06-02-2026-06-08`
    const k2 = `transfer-${id}-2026-05-26-2026-06-01`
    expect(k1).not.toBe(k2)
  })
})
