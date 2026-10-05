import { describe, it, expect } from "vitest"
import { calculateCancellationFee, calculateRefundPercent, isWaivedReason } from "@/lib/utils/refunds"
import type { CancellationConfig } from "@/lib/platform/settings"

// The agreed ladder: free more than 48h ahead · half price inside 48h · full price inside 24h.
// Mirrors the defaults seeded in scripts/ensure-referrals.mjs and getCancellationConfig().
const cfg: CancellationConfig = {
  tier1Hours: 48,
  tier2Hours: 24,
  tier3Hours: 2,
  feeLowPct: 50,
  feeMediumPct: 100,
  feeLatePct: 100,
  travelCompCents: 500,
  noshowGraceMinutes: 15,
}

describe("calculateCancellationFee — the 48h / 24h ladder", () => {
  describe("client cancels", () => {
    it("free with more than 48 hours' notice", () => {
      expect(calculateCancellationFee(72, "customer", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0, cancellerFeePercent: 0 })
      expect(calculateCancellationFee(48.1, "customer", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0, cancellerFeePercent: 0 })
    })

    it("half price between 24 and 48 hours", () => {
      expect(calculateCancellationFee(48, "customer", cfg)).toEqual({ refundPercent: 50, feePercent: 50, travelCompensationCents: 0, cancellerFeePercent: 50 })
      expect(calculateCancellationFee(36, "customer", cfg)).toEqual({ refundPercent: 50, feePercent: 50, travelCompensationCents: 0, cancellerFeePercent: 50 })
      expect(calculateCancellationFee(24.1, "customer", cfg)).toEqual({ refundPercent: 50, feePercent: 50, travelCompensationCents: 0, cancellerFeePercent: 50 })
    })

    it("full price with 24 hours' notice or less", () => {
      expect(calculateCancellationFee(24, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 0, cancellerFeePercent: 100 })
      expect(calculateCancellationFee(12, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 0, cancellerFeePercent: 100 })
      expect(calculateCancellationFee(2.1, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 0, cancellerFeePercent: 100 })
    })

    it("adds travel compensation only in the last 2 hours, when the cleaner may already be travelling", () => {
      expect(calculateCancellationFee(2, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 500, cancellerFeePercent: 100 })
      expect(calculateCancellationFee(0, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 500, cancellerFeePercent: 100 })
      expect(calculateCancellationFee(-1, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 500, cancellerFeePercent: 100 })
    })
  })

  describe("cleaner cancels — same ladder, but the client is never charged for it", () => {
    it("the client is always refunded in full, whatever the notice", () => {
      for (const hours of [72, 36, 12, 1, 0]) {
        const r = calculateCancellationFee(hours, "provider", cfg)
        expect(r.refundPercent).toBe(100)
        expect(r.feePercent).toBe(0)
        expect(r.travelCompensationCents).toBe(0)
      }
    })

    it("but the cleaner carries the same liability as a client would", () => {
      expect(calculateCancellationFee(72, "provider", cfg).cancellerFeePercent).toBe(0)
      expect(calculateCancellationFee(36, "provider", cfg).cancellerFeePercent).toBe(50)
      expect(calculateCancellationFee(12, "provider", cfg).cancellerFeePercent).toBe(100)
    })
  })

  describe("unavoidable circumstances waive the fee", () => {
    it.each(["illness", "transport"])("%s waives it at any notice, for both sides", (reason) => {
      expect(calculateCancellationFee(0, "customer", cfg, reason)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0, cancellerFeePercent: 0 })
      expect(calculateCancellationFee(0, "provider", cfg, reason)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0, cancellerFeePercent: 0 })
    })

    it("'other' does not waive anything — otherwise the ladder would mean nothing", () => {
      expect(calculateCancellationFee(12, "customer", cfg, "other").feePercent).toBe(100)
    })

    it("an unknown or missing category is treated as no waiver", () => {
      expect(isWaivedReason(null)).toBe(false)
      expect(isWaivedReason(undefined)).toBe(false)
      expect(isWaivedReason("")).toBe(false)
      expect(isWaivedReason("free-holiday")).toBe(false)
      expect(calculateCancellationFee(12, "customer", cfg, "free-holiday").feePercent).toBe(100)
    })
  })
})

describe("calculateRefundPercent — back-compat wrapper", () => {
  it("returns just the refund percent", () => {
    expect(calculateRefundPercent(72, "customer", cfg)).toBe(100)
    expect(calculateRefundPercent(36, "customer", cfg)).toBe(50)
    expect(calculateRefundPercent(0, "provider", cfg)).toBe(100)
  })
})
