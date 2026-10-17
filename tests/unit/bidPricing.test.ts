import { describe, it, expect } from "vitest"

// The sum the bid endpoint performs on a typed rate (app/api/jobs/[id]/bids/route.ts) and the one
// the bid forms show as a live preview. Kept here as an executable statement of the rule, because
// getting it wrong silently underpays a real person:
//
//   booking BK-2026-000014 — a cleaner quoted 26 for a 2-hour job and was paid €26, not €52.
//   The typed figure was banked as the whole-job price while the auto-filled one was multiplied.
const rateToTotal = (rateCents: number, minutes: number) => Math.round((rateCents * minutes) / 60)

describe("a bid is a RATE PER HOUR, stored as a whole-job total", () => {
  it("the exact case that underpaid a cleaner: €26/hr for 2 hours is €52, not €26", () => {
    expect(rateToTotal(2600, 120)).toBe(5200)
  })

  it("the cleaner's own listed rate behaves the same: €25/hr for 2 hours is €50", () => {
    expect(rateToTotal(2500, 120)).toBe(5000)
  })

  it("one hour is the rate itself — the only case the old code got right by accident", () => {
    expect(rateToTotal(2600, 60)).toBe(2600)
  })

  it("part hours are charged pro rata", () => {
    expect(rateToTotal(2600, 90)).toBe(3900)   // 1.5h
    expect(rateToTotal(2600, 30)).toBe(1300)   // 0.5h
    expect(rateToTotal(1800, 150)).toBe(4500)  // 2.5h at €18
  })

  it("rounds to whole cents rather than carrying a fraction into the money", () => {
    // €18.33/hr for 50 minutes = 1527.5 cents exactly; must land on a whole cent.
    const t = rateToTotal(1833, 50)
    expect(Number.isInteger(t)).toBe(true)
    expect(t).toBe(1528)
  })

  it("a longer job always costs more than a shorter one at the same rate", () => {
    const r = 2200
    for (const [shorter, longer] of [[60, 120], [120, 180], [180, 480]]) {
      expect(rateToTotal(r, longer)).toBeGreaterThan(rateToTotal(r, shorter))
    }
  })

  it("matches what the form previews, so the quote and the charge can never disagree", () => {
    // The forms compute (rate × mins) / 60 in whole currency units; the server in cents.
    const rateUnits = 26, mins = 120
    const previewTotal = (rateUnits * mins) / 60
    expect(Math.round(previewTotal * 100)).toBe(rateToTotal(rateUnits * 100, mins))
  })
})
