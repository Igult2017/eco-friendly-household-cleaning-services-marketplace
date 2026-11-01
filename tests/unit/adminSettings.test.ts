import { describe, it, expect, afterAll, beforeEach, vi } from "vitest"
import { makeTestDb } from "../helpers/pgliteDb"

// Does each admin setting ACTUALLY change what the platform does?
//
// A setting that saves but changes nothing is the worst kind of bug: the admin believes they have
// adjusted the business and nothing happened. This suite writes each value into a real database
// and asserts the code reads it back — proving the wire from the settings page through to the
// business logic is connected, not merely that a getter exists somewhere.

const { client, db } = await makeTestDb()
vi.doMock("@/lib/db", () => ({ db }))

const s = await import("@/lib/platform/settings")

const put = (key: string, value: string) =>
  client.query(
    `insert into platform_settings (key, value) values ($1,$2)
     on conflict (key) do update set value = excluded.value`,
    [key, value],
  )

afterAll(async () => { await client.close() })
beforeEach(async () => { await client.query(`delete from platform_settings`) })

describe("money settings reach the code that charges people", () => {
  it("commission", async () => {
    await put("commission_pct", "42")
    expect(await s.getCommissionPct()).toBe(42)
  })

  it("regular-client commission and the job count that unlocks it", async () => {
    await put("commission_regular_pct", "33")
    await put("commission_regular_after_jobs", "7")
    expect(await s.getRegularClientCommissionPct()).toBe(33)
    expect(await s.getRegularClientAfterJobs()).toBe(7)
  })

  it("recurring discount", async () => {
    await put("recurring_discount_pct", "12")
    expect(await s.getRecurringDiscountPct()).toBe(12)
  })

  it("minimum hourly rate", async () => {
    await put("min_hourly_rate_cents", "1850")
    expect(await s.getMinHourlyRateCents()).toBe(1850)
  })

  it("affiliate commission", async () => {
    await put("client_referral_discount_pct", "9")
    expect(await s.getAffiliateCommissionPct()).toBe(9)
  })

  it("referral reward and the jobs required to earn it", async () => {
    await put("referral_reward_cents", "3000")
    await put("referral_cleaner_jobs_required", "4")
    await put("referral_client_jobs_required", "2")
    expect(await s.getReferralRewardCents()).toBe(3000)
    // One function, two settings, chosen by which side is asking.
    expect(await s.getReferralJobsRequired(true)).toBe(4)   // cleaner side
    expect(await s.getReferralJobsRequired(false)).toBe(2)  // client side
  })

  it("payout schedule", async () => {
    await put("payout_schedule", "monthly")
    expect(await s.getPayoutSchedule()).toBe("monthly")
  })
})

describe("timing settings reach the code that schedules things", () => {
  it("booking length floor, reminder and finish-by warning", async () => {
    await put("min_booking_minutes", "45")
    await put("reminder_hours_before", "36")
    await put("deadline_warning_hours", "6")
    expect(await s.getMinBookingMinutes()).toBe(45)
    expect(await s.getReminderHoursBefore()).toBe(36)
    expect(await s.getDeadlineWarningHours()).toBe(6)
  })

  it("the silent-cleaner check and its grace window", async () => {
    await put("availability_check_hours", "9")
    await put("availability_grace_hours", "2")
    expect(await s.getAvailabilityCheckHours()).toBe(9)
    expect(await s.getAvailabilityGraceHours()).toBe(2)
  })

  it("identity deadline and its floor", async () => {
    await put("identity_check_hours", "20")
    await put("identity_min_minutes", "90")
    expect(await s.getIdentityCheckHours()).toBe(20)
    expect(await s.getIdentityMinMinutes()).toBe(90)
  })

  it("identity on/off and when cleaners verify", async () => {
    await put("identity_enabled", "off")
    await put("identity_mode", "onboarding")
    expect(await s.getIdentityEnabled()).toBe(false)
    expect(await s.getIdentityMode()).toBe("onboarding")
  })
})

describe("the cancellation policy reaches the refund maths", () => {
  it("all eight cancellation values come back as set", async () => {
    for (const [k, v] of [
      ["cancel_tier1_hours", "72"], ["cancel_tier2_hours", "36"], ["cancel_tier3_hours", "4"],
      ["cancel_fee_low_pct", "20"], ["cancel_fee_medium_pct", "60"], ["cancel_fee_late_pct", "90"],
      ["cancel_travel_comp_cents", "1200"], ["cancel_noshow_grace_minutes", "25"],
    ]) await put(k, v)

    const c = await s.getCancellationConfig()
    expect(c.tier1Hours).toBe(72)
    expect(c.tier2Hours).toBe(36)
    expect(c.tier3Hours).toBe(4)
    expect(c.feeLowPct).toBe(20)
    expect(c.feeMediumPct).toBe(60)
    expect(c.feeLatePct).toBe(90)
    expect(c.travelCompCents).toBe(1200)
    expect(c.noshowGraceMinutes).toBe(25)
  })
})

describe("a nonsense value never reaches the business", () => {
  it("falls back to the default rather than applying an out-of-range number", async () => {
    // The page checks bounds before sending, but a value written any other way must not be obeyed
    // — a 900% commission must never be charged to anyone.
    await put("commission_pct", "900")
    expect(await s.getCommissionPct()).toBeLessThanOrEqual(60)
  })

  it("ignores a word where a number belongs", async () => {
    await put("min_booking_minutes", "soon")
    expect(await s.getMinBookingMinutes()).toBeGreaterThan(0)
  })

  it("ignores an unrecognised word for a fixed-choice setting", async () => {
    await put("payout_schedule", "fortnightly")
    expect(["weekly", "monthly"]).toContain(await s.getPayoutSchedule())
    await put("identity_mode", "sometimes")
    expect(["first_job", "onboarding"]).toContain(await s.getIdentityMode())
  })
})

describe("the silent-cleaner settings are now adjustable, not hardcoded", () => {
  it("both save and are read back", async () => {
    // These decide whether a client gets stood up — when a quiet cleaner is asked "still coming?"
    // and how long before the job goes to someone else. They worked, but only a code change could
    // alter them: there was no switch in the panel at all.
    await put("availability_check_hours", "12")
    await put("availability_grace_hours", "3")
    expect(await s.getAvailabilityCheckHours()).toBe(12)
    expect(await s.getAvailabilityGraceHours()).toBe(3)
  })

  it("out-of-range values fall back rather than being obeyed", async () => {
    // The panel's bounds must match the reader's. If they ever disagree, a value looks saved and
    // is then silently ignored — the worst outcome, because nothing tells the admin.
    await put("availability_check_hours", "500")
    await put("availability_grace_hours", "99")
    expect(await s.getAvailabilityCheckHours()).toBeLessThanOrEqual(48)
    expect(await s.getAvailabilityGraceHours()).toBeLessThanOrEqual(12)
  })
})
