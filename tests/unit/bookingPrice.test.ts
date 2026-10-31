import { describe, it, expect } from "vitest"
import { priceForService, explainPrice, DEFAULT_DURATION_MINUTES } from "@/lib/bookings/price"

// What a cleaning costs, and the workings behind it.
//
// THE BUG THESE PIN: repeat cleanings kept their own copy of this sum and simply took the hourly
// rate as the whole price. A client booking a weekly clean at €20/hr was charged €20 no matter how
// many hours they booked, and the cleaner was paid for one hour — every week, with nothing on
// screen showing it. Real bookings: BK-2026-000010 to 000013 (6, 13, 20, 27 September — exactly a
// week apart) and BK-2026-000015.

describe("an hourly rate is multiplied by the hours booked", () => {
  it("THE BUG: 3 hours at €20/hr is €60, not €20", () => {
    expect(priceForService({ basePrice: 2000, priceUnit: "per_hour", durationMinutes: 180 })).toBe(6000)
  })

  it("reproduces exactly what the wrong bookings were charged, and what they should have been", () => {
    // Charged €20 because the hours were never applied. The schedules were for more than an hour.
    const wrong = 2000
    expect(priceForService({ basePrice: 2000, priceUnit: "per_hour", durationMinutes: 60 })).toBe(wrong)
    // Same rate, the hours actually applied:
    expect(priceForService({ basePrice: 2000, priceUnit: "per_hour", durationMinutes: 120 })).toBe(4000)
    expect(priceForService({ basePrice: 2500, priceUnit: "per_hour", durationMinutes: 120 })).toBe(5000)
  })

  it("handles part hours without losing a fraction of a cent", () => {
    expect(priceForService({ basePrice: 2000, priceUnit: "per_hour", durationMinutes: 90 })).toBe(3000)
    expect(priceForService({ basePrice: 1833, priceUnit: "per_hour", durationMinutes: 50 })).toBe(1528)
    expect(Number.isInteger(priceForService({ basePrice: 1833, priceUnit: "per_hour", durationMinutes: 50 }))).toBe(true)
  })

  it("a whole-job price is NOT multiplied, however long the job runs", () => {
    for (const minutes of [60, 120, 240, 480]) {
      expect(priceForService({ basePrice: 7500, priceUnit: "per_job", durationMinutes: minutes })).toBe(7500)
    }
  })

  it("treats an unknown or missing unit as a whole-job price, never as an hourly rate", () => {
    // Failing the safe way: guessing "per hour" on a missing unit would multiply a flat price and
    // overcharge a real client.
    expect(priceForService({ basePrice: 5000, priceUnit: null, durationMinutes: 240 })).toBe(5000)
    expect(priceForService({ basePrice: 5000, priceUnit: "per_visit", durationMinutes: 240 })).toBe(5000)
  })

  it("more hours always costs more at the same rate", () => {
    const rate = 2200
    for (const [shorter, longer] of [[60, 120], [120, 180], [180, 480]]) {
      expect(priceForService({ basePrice: rate, priceUnit: "per_hour", durationMinutes: longer }))
        .toBeGreaterThan(priceForService({ basePrice: rate, priceUnit: "per_hour", durationMinutes: shorter }))
    }
  })
})

describe("the paper trail explains the charge rather than asserting it", () => {
  it("writes the sum out in words, and marks a correct charge with no gap", () => {
    const w = explainPrice({
      basePrice: 2000, priceUnit: "per_hour", durationMinutes: 180,
      durationSource: "schedule", chargedCents: 6000,
    })
    expect(w.expected).toBe(6000)
    expect(w.charged).toBe(6000)
    expect(w.mismatch).toBe(0)
    expect(w.summary).toBe("20.00/hr × 3.0 hrs = 60.00 — charged 60.00")
  })

  it("reports the gap when the charge does not match the sum — the whole point", () => {
    // This is precisely the old behaviour: 3 hours booked, one hour charged.
    const w = explainPrice({
      basePrice: 2000, priceUnit: "per_hour", durationMinutes: 180,
      durationSource: "schedule", chargedCents: 2000,
    })
    expect(w.expected).toBe(6000)
    expect(w.mismatch).toBe(-4000)   // €40 short — the cleaner's missing pay
  })

  it("says when the hours were assumed rather than recorded", () => {
    // Schedules created before the duration was stored. The number is a guess, and a guess about
    // money must be visible.
    const w = explainPrice({
      basePrice: 2000, priceUnit: "per_hour", durationMinutes: DEFAULT_DURATION_MINUTES,
      durationSource: "fallback", chargedCents: 4000,
    })
    expect(w.durationSource).toBe("fallback")
    expect(w.minutes).toBe(120)
    expect(w.mismatch).toBe(0)
  })

  it("carries the rate and unit, so a charge can be checked without the database", () => {
    const w = explainPrice({
      basePrice: 5000, priceUnit: "per_job", durationMinutes: 240,
      durationSource: "schedule", chargedCents: 5000,
    })
    expect(w.rate).toBe(5000)
    expect(w.unit).toBe("per_job")
    expect(w.summary).toBe("50.00 for the job — charged 50.00")
  })
})
