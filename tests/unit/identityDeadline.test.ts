import { describe, it, expect } from "vitest"

// The clock a cleaner is given to verify their identity after being awarded a job, and the rule
// for when an attempt costs them one of their two tries. Both were wrong, and both are the kind of
// wrong that only shows up with a real cleaner and a real job on the line — so they are pinned
// here as executable statements of the rule.

// ---------------------------------------------------------------------------------------------
// The deadline. Mirrors lib/bookings/identityGate.ts requireIdentityOnAward.
// ---------------------------------------------------------------------------------------------
const REASSIGN_BUFFER_HOURS = 2

/** now + hours, but never later than 2h before the job, and never sooner than the floor. */
const dueAt = (now: number, scheduledAt: number, hours: number, minMinutes: number) => {
  const fromNow = now + hours * 3_600_000
  const lastUseful = scheduledAt - REASSIGN_BUFFER_HOURS * 3_600_000
  const floor = now + minMinutes * 60_000
  return Math.max(floor, Math.min(fromNow, lastUseful))
}

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)
const hoursFromNow = (h: number) => NOW + h * 3_600_000
const minutesAfterNow = (ms: number) => (ms - NOW) / 60_000

describe("the identity deadline is never already in the past", () => {
  it("THE BUG: a job starting in 30 minutes used to produce a deadline 90 minutes BEHIND us", () => {
    // Emergency "Take Job" bookings are routinely this close. Without the floor the cleaner was
    // handed an expired clock and lost the job on the very next sweep, having never had a chance.
    const withoutFloor = Math.min(hoursFromNow(12), hoursFromNow(0.5) - 2 * 3_600_000)
    expect(minutesAfterNow(withoutFloor)).toBe(-90)      // the old behaviour: already expired

    const withFloor = dueAt(NOW, hoursFromNow(0.5), 12, 45)
    expect(minutesAfterNow(withFloor)).toBe(45)          // a real chance instead
  })

  it("never returns a deadline at or before now, at any job start time", () => {
    for (const startHours of [0, 0.25, 0.5, 1, 1.9, 2, 2.5, 4, 12, 48, 24 * 30]) {
      const d = dueAt(NOW, hoursFromNow(startHours), 12, 45)
      expect(d).toBeGreaterThan(NOW)
    }
  })

  it("a job far in the future still gets the normal 12 hours, not the floor", () => {
    const d = dueAt(NOW, hoursFromNow(48), 12, 45)
    expect(minutesAfterNow(d)).toBe(12 * 60)
  })

  it("a job in 3 hours gets 1 hour — capped by the job, not the setting", () => {
    // Still the original intent: leave 2 hours to find somebody else.
    const d = dueAt(NOW, hoursFromNow(3), 12, 45)
    expect(minutesAfterNow(d)).toBe(60)
  })

  it("the floor only ever lengthens the deadline, never shortens it", () => {
    for (const startHours of [0.5, 3, 6, 24]) {
      const withFloor = dueAt(NOW, hoursFromNow(startHours), 12, 45)
      const withoutFloor = Math.min(hoursFromNow(12), hoursFromNow(startHours) - 2 * 3_600_000)
      expect(withFloor).toBeGreaterThanOrEqual(withoutFloor)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// What costs a cleaner one of their attempts. Mirrors the webhook's requires_input branch.
// ---------------------------------------------------------------------------------------------

/**
 * Stripe's own words: "you're charged for every SUBMITTED verification, regardless of the
 * outcome." A session that was merely opened and closed is never billed — so it must never cost
 * the cleaner an attempt either. `last_error` is what tells the two apart.
 */
const costsAnAttempt = (lastErrorCode: string | null | undefined) => Boolean(lastErrorCode)

describe("an attempt is spent on a SUBMITTED check, never on opening the pop-up", () => {
  it("THE BUG: closing the pop-up twice used to lock a cleaner out having checked nothing", () => {
    // Two accidental closes, no document ever submitted, nothing billed — and the third click
    // returned "contact support", where no support path existed.
    expect(costsAnAttempt(null)).toBe(false)
    expect(costsAnAttempt(undefined)).toBe(false)
  })

  it("a genuine failure does spend one — Stripe bills a failed check like a passed one", () => {
    for (const code of ["document_expired", "selfie_face_mismatch", "document_type_not_supported"]) {
      expect(costsAnAttempt(code)).toBe(true)
    }
  })

  it("two real failures exhaust the two attempts; two abandonments do not", () => {
    const MAX = 2
    const spend = (codes: Array<string | null>) => codes.filter(costsAnAttempt).length

    expect(spend(["document_expired", "selfie_face_mismatch"])).toBe(MAX)
    expect(spend([null, null, null, null])).toBe(0)
    expect(spend([null, "document_expired", null])).toBe(1)
  })
})
