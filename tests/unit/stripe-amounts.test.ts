import { describe, it, expect } from "vitest"
import { calculateBookingAmounts } from "@/lib/stripe/client"

describe("calculateBookingAmounts", () => {
  it("charges 15% platform fee on top of provider price", () => {
    const result = calculateBookingAmounts(10_000) // €100 service
    expect(result.subtotalCents).toBe(10_000)
    expect(result.platformFee).toBe(1_500)        // €15
    expect(result.totalCharged).toBe(11_500)       // €115
    expect(result.providerPayout).toBe(10_000)     // provider keeps 100%
  })

  it("rounds platform fee down on fractional cents", () => {
    const result = calculateBookingAmounts(333) // €3.33
    expect(result.platformFee).toBe(50)            // Math.round(333 * 0.15) = 50
    expect(result.totalCharged).toBe(383)
    expect(result.providerPayout).toBe(333)
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
