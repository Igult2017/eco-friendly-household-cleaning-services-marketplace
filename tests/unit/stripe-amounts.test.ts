import { describe, it, expect } from "vitest"
import { calculateBookingAmounts } from "@/lib/stripe/client"

describe("calculateBookingAmounts", () => {
  it("deducts the platform commission from the provider payout (customer pays the rate)", () => {
    const result = calculateBookingAmounts(10_000) // €100 service
    expect(result.subtotalCents).toBe(10_000)
    expect(result.platformFee).toBe(1_500)        // €15 commission
    expect(result.totalCharged).toBe(10_000)       // customer pays the rate — no fee on top
    expect(result.providerPayout).toBe(8_500)      // cleaner nets rate minus commission
  })

  it("rounds the platform commission on fractional cents", () => {
    const result = calculateBookingAmounts(333) // €3.33
    expect(result.platformFee).toBe(50)            // Math.round(333 * 0.15) = 50
    expect(result.totalCharged).toBe(333)          // customer pays the rate
    expect(result.providerPayout).toBe(283)        // 333 - 50
  })

  it("customer always pays more than the provider receives", () => {
    for (const price of [500, 5_000, 50_000]) {
      const r = calculateBookingAmounts(price)
      expect(r.totalCharged).toBeGreaterThan(r.providerPayout)
    }
  })

  it("platform fee + provider payout = total charged", () => {
    const r = calculateBookingAmounts(8_750)
    expect(r.platformFee + r.providerPayout).toBe(r.totalCharged)
  })
})
