import { describe, it, expect } from "vitest"
import { calculateCancellationFee, calculateRefundPercent } from "@/lib/utils/refunds"
import type { CancellationConfig } from "@/lib/platform/settings"

// Mirrors the default platform_settings values seeded in scripts/ensure-referrals.mjs.
const cfg: CancellationConfig = {
  tier1Hours: 24,
  tier2Hours: 6,
  tier3Hours: 2,
  feeLowPct: 10,
  feeMediumPct: 30,
  feeLatePct: 100,
  travelCompCents: 500,
  noshowGraceMinutes: 15,
}

describe("calculateCancellationFee — 4-tier admin-configurable policy", () => {
  describe("customer cancels", () => {
    it("free (100% refund) when more than tier1Hours before the job", () => {
      expect(calculateCancellationFee(72, "customer", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0 })
      expect(calculateCancellationFee(24.1, "customer", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0 })
    })

    it("low fee between tier2Hours and tier1Hours", () => {
      expect(calculateCancellationFee(24, "customer", cfg)).toEqual({ refundPercent: 90, feePercent: 10, travelCompensationCents: 0 })
      expect(calculateCancellationFee(6.1, "customer", cfg)).toEqual({ refundPercent: 90, feePercent: 10, travelCompensationCents: 0 })
    })

    it("medium fee between tier3Hours and tier2Hours", () => {
      expect(calculateCancellationFee(6, "customer", cfg)).toEqual({ refundPercent: 70, feePercent: 30, travelCompensationCents: 0 })
      expect(calculateCancellationFee(2.1, "customer", cfg)).toEqual({ refundPercent: 70, feePercent: 30, travelCompensationCents: 0 })
    })

    it("late fee + travel compensation at or below tier3Hours", () => {
      expect(calculateCancellationFee(2, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 500 })
      expect(calculateCancellationFee(0, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 500 })
      expect(calculateCancellationFee(-1, "customer", cfg)).toEqual({ refundPercent: 0, feePercent: 100, travelCompensationCents: 500 })
    })
  })

  describe("provider cancels", () => {
    it("always full refund, no fee, no travel comp, regardless of timing", () => {
      expect(calculateCancellationFee(0, "provider", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0 })
      expect(calculateCancellationFee(1, "provider", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0 })
      expect(calculateCancellationFee(100, "provider", cfg)).toEqual({ refundPercent: 100, feePercent: 0, travelCompensationCents: 0 })
    })
  })
})

describe("calculateRefundPercent — back-compat wrapper", () => {
  it("returns just the refund percent", () => {
    expect(calculateRefundPercent(72, "customer", cfg)).toBe(100)
    expect(calculateRefundPercent(12, "customer", cfg)).toBe(90) // between tier2Hours(6) and tier1Hours(24) = low fee
    expect(calculateRefundPercent(0, "provider", cfg)).toBe(100)
  })
})
