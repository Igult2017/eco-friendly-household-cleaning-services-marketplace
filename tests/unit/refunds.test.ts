import { describe, it, expect } from "vitest"
import { calculateRefundPercent, calculateRefundAmount } from "@/lib/utils/refunds"

describe("calculateRefundPercent — tiered cancellation policy", () => {
  describe("customer cancels", () => {
    it("100% refund when >48h before job", () => {
      expect(calculateRefundPercent(72, "customer")).toBe(100)
      expect(calculateRefundPercent(49, "customer")).toBe(100)
    })

    it("50% refund when 24–48h before job", () => {
      expect(calculateRefundPercent(48, "customer")).toBe(50)
      expect(calculateRefundPercent(36, "customer")).toBe(50)
      expect(calculateRefundPercent(24.1, "customer")).toBe(50)
    })

    it("0% refund when <24h before job", () => {
      expect(calculateRefundPercent(24, "customer")).toBe(0)
      expect(calculateRefundPercent(12, "customer")).toBe(0)
      expect(calculateRefundPercent(0, "customer")).toBe(0)
      expect(calculateRefundPercent(-1, "customer")).toBe(0)
    })
  })

  describe("provider cancels", () => {
    it("always 100% refund regardless of timing", () => {
      expect(calculateRefundPercent(0, "provider")).toBe(100)
      expect(calculateRefundPercent(1, "provider")).toBe(100)
      expect(calculateRefundPercent(100, "provider")).toBe(100)
    })
  })
})

describe("calculateRefundAmount", () => {
  it("full amount for >48h customer cancel", () => {
    expect(calculateRefundAmount(11_500, 72, "customer")).toBe(11_500)
  })

  it("half amount for 24–48h customer cancel", () => {
    expect(calculateRefundAmount(11_500, 36, "customer")).toBe(5_750)
  })

  it("zero amount for <24h customer cancel", () => {
    expect(calculateRefundAmount(11_500, 12, "customer")).toBe(0)
  })

  it("full amount for provider cancel at any time", () => {
    expect(calculateRefundAmount(11_500, 2, "provider")).toBe(11_500)
  })

  it("rounds fractional cents correctly", () => {
    // 50% of €11,501 = 5750.5 → rounds to 5751
    expect(calculateRefundAmount(11_501, 36, "customer")).toBe(5_751)
  })
})
