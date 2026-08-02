import { describe, it, expect } from "vitest"
import { calculateBookingAmounts, calculateDiscountedBookingAmounts } from "@/lib/stripe/client"

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

describe("calculateDiscountedBookingAmounts", () => {
  it("funds a normal discount entirely from platform commission — provider payout is untouched", () => {
    // €100 service, 15% commission, 10% recurring discount
    const full = calculateBookingAmounts(10_000, 15)
    const r = calculateDiscountedBookingAmounts(10_000, 15, 10)
    expect(r.discountCents).toBe(1_000)              // 10% of €100
    expect(r.totalCharged).toBe(9_000)                // customer pays €90
    expect(r.platformFee).toBe(500)                   // €15 commission - €10 discount
    expect(r.providerPayout).toBe(full.providerPayout) // cleaner still gets exactly the full-price payout
    expect(r.providerPayout).toBe(8_500)
  })

  it("clamps the discount at the full commission — never goes negative, cleaner still unaffected", () => {
    // A discount rate so high it would exceed the entire €15 commission on a €100 job.
    const r = calculateDiscountedBookingAmounts(10_000, 15, 50) // raw discount would be €50
    expect(r.discountCents).toBe(1_500)  // clamped to the full commission, not the raw 5,000
    expect(r.platformFee).toBe(0)        // platform's cut floors at zero, never negative
    expect(r.providerPayout).toBe(8_500) // cleaner is still paid as if this were a full-price job
    expect(r.totalCharged).toBe(8_500)   // customer charge floors at exactly the cleaner's payout
  })

  it("zero discount behaves identically to the undiscounted calculation", () => {
    const full = calculateBookingAmounts(7_500, 15)
    const r = calculateDiscountedBookingAmounts(7_500, 15, 0)
    expect(r.discountCents).toBe(0)
    expect(r.totalCharged).toBe(full.totalCharged)
    expect(r.platformFee).toBe(full.platformFee)
    expect(r.providerPayout).toBe(full.providerPayout)
  })

  it("platform fee + provider payout always sums back to total charged, discounted or not", () => {
    for (const [subtotal, commissionPct, discountPct] of [[10_000, 15, 10], [10_000, 15, 50], [3_333, 20, 33], [500, 10, 100]] as const) {
      const r = calculateDiscountedBookingAmounts(subtotal, commissionPct, discountPct)
      expect(r.platformFee + r.providerPayout).toBe(r.totalCharged)
      expect(r.platformFee).toBeGreaterThanOrEqual(0)
      expect(r.totalCharged).toBeGreaterThanOrEqual(r.providerPayout)
    }
  })
})
