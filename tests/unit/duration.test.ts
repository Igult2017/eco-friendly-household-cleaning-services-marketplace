import { describe, it, expect } from "vitest"
import {
  durationOptions, formatHours, hoursToMinutes, minutesToHours,
  MIN_DURATION_MINUTES, MAX_DURATION_MINUTES,
} from "@/lib/utils/duration"

// Hours for people, minutes for the database.
//
// Cleaners used to type minutes into a box labelled "(mins)" while clients picked "2 hours". That
// number multiplies the hourly rate into a bid, so the unit mattered: typing "2" meaning two hours
// was rejected by the server's 30-minute floor with a message that explained nothing.

describe("what a person sees", () => {
  it("says hours, the way someone would actually say it", () => {
    expect(formatHours(60)).toBe("1 hour")
    expect(formatHours(90)).toBe("1½ hours")
    expect(formatHours(120)).toBe("2 hours")
    expect(formatHours(150)).toBe("2½ hours")
    expect(formatHours(480)).toBe("8 hours")
  })

  it("keeps minutes only below an hour, where hours would read oddly", () => {
    expect(formatHours(30)).toBe("30 min")
    expect(formatHours(45)).toBe("45 min")
  })
})

describe("hours convert to the stored unit and back", () => {
  it("2 hours is 120 minutes; an hour and a half is 90", () => {
    expect(hoursToMinutes(2)).toBe(120)
    expect(hoursToMinutes(1.5)).toBe(90)
    expect(hoursToMinutes(0.5)).toBe(30)
  })

  it("round-trips without drifting", () => {
    for (const minutes of [30, 60, 90, 120, 210, 480]) {
      expect(hoursToMinutes(minutesToHours(minutes))).toBe(minutes)
    }
  })
})

describe("every option offered is one the server will accept", () => {
  it("never offers less than 30 minutes or more than 8 hours", () => {
    // The bounds app/api/jobs/[id]/bids/route.ts already enforces. Because the picker cannot
    // produce anything outside them, the old "type 2, get rejected" path cannot happen at all.
    const opts = durationOptions()
    expect(opts[0].minutes).toBe(MIN_DURATION_MINUTES)
    expect(opts[opts.length - 1].minutes).toBe(MAX_DURATION_MINUTES)
    for (const o of opts) {
      expect(o.minutes).toBeGreaterThanOrEqual(MIN_DURATION_MINUTES)
      expect(o.minutes).toBeLessThanOrEqual(MAX_DURATION_MINUTES)
    }
  })

  it("steps in half hours, because real cleans are not all whole hours", () => {
    const opts = durationOptions()
    for (let i = 1; i < opts.length; i++) {
      expect(opts[i].minutes - opts[i - 1].minutes).toBe(30)
    }
    expect(opts.map((o) => o.minutes)).toContain(90)
  })

  it("respects a narrower range without ever going outside the hard limits", () => {
    const opts = durationOptions(60, 180)
    expect(opts[0].minutes).toBe(60)
    expect(opts[opts.length - 1].minutes).toBe(180)

    // A service asking for something impossible is clamped rather than obeyed.
    const silly = durationOptions(5, 10_000)
    expect(silly[0].minutes).toBe(MIN_DURATION_MINUTES)
    expect(silly[silly.length - 1].minutes).toBe(MAX_DURATION_MINUTES)
  })

  it("always returns at least one choice, even when asked for a backwards range", () => {
    // An empty picker would leave a cleaner unable to bid at all.
    expect(durationOptions(240, 60).length).toBeGreaterThan(0)
  })
})
