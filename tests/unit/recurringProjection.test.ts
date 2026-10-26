import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { makeTestDb } from "../helpers/pgliteDb"

// The calendar's view of recurring cleanings, against a REAL Postgres with the real schema.
//
// THE BUG: both calendars read only the bookings table, and recurring bookings are created one at
// a time by a daily job looking 24 hours ahead. So a client who booked twice-weekly cleaning saw
// exactly ONE upcoming date instead of the series, and the cleaner saw the same single date —
// neither could see what they had committed to.
//
// Creating the bookings up front would be the wrong fix (every booking carries a real card charge),
// so these dates are PROJECTED. These tests pin that the projection matches the dates the real
// generator would produce, and that it never invents a cleaning that is already booked.

const { client, db } = await makeTestDb()
vi.doMock("@/lib/db", () => ({ db }))

const { projectRecurringDates } = await import("@/lib/bookings/recurringProjection")
const { addFrequencyInTZ } = await import("@/lib/inngest/functions/recurring")

const CUSTOMER_ID = "user_test_client"
const PROVIDER_USER_ID = "user_test_cleaner"
const PROVIDER_ID = "33333333-3333-3333-3333-333333333333"
const SERVICE_ID = "44444444-4444-4444-4444-444444444444"

/** Creates a recurring schedule whose next cleaning is `daysAhead` from now. */
async function makeSchedule(frequency: "weekly" | "biweekly" | "monthly", daysAhead: number, tz = "Europe/Berlin") {
  const next = new Date(Date.now() + daysAhead * 86_400_000)
  const r = await client.query<{ id: string }>(
    `insert into recurring_schedules
       (customer_id, provider_id, service_id, frequency, day_of_week, preferred_time,
        service_address, timezone, status, next_booking_at)
     values ($1,$2,$3,$4::recurring_frequency,$5,'10:00',
        '{"line1":"1 Test St","city":"Testville","postalCode":"00000","country":"DE"}'::jsonb,
        $6,'active',$7)
     returning id`,
    [CUSTOMER_ID, PROVIDER_ID, SERVICE_ID, frequency, next.getUTCDay(), tz, next],
  )
  return { id: r.rows[0].id, next }
}

beforeAll(async () => {
  await client.query(
    `insert into users (id, email, first_name, last_name, role)
     values ($1,'client@test.invalid','Test','Client','customer'), ($2,'cleaner@test.invalid','Test','Cleaner','provider')`,
    [CUSTOMER_ID, PROVIDER_USER_ID],
  )
  await client.query(
    `insert into providers (id, user_id, business_name, slug, country, timezone)
     values ($1,$2,'Sparkle Cleaners','sparkle','DE','Europe/Berlin')`,
    [PROVIDER_ID, PROVIDER_USER_ID],
  )
  const cat = await client.query<{ id: string }>(
    `insert into service_categories (name, slug) values ('Home cleaning','home-cleaning') returning id`,
  )
  await client.query(
    `insert into provider_services (id, provider_id, category_id, name, base_price) values ($1,$2,$3,'Standard clean',5000)`,
    [SERVICE_ID, PROVIDER_ID, cat.rows[0].id],
  )
})

afterAll(async () => { await client.close() })

beforeEach(async () => {
  await client.query(`delete from recurring_schedules`)
  await client.query(`delete from bookings`)
})

describe("a recurring booking shows the whole series, not just the next one", () => {
  it("THE BUG: weekly cleaning now shows many dates, where the calendar showed one", async () => {
    await makeSchedule("weekly", 2)

    const dates = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })

    // ~13 weeks in 3 months. The old behaviour was exactly 1 visible date.
    expect(dates.length).toBeGreaterThan(10)
  })

  it("twice-weekly shows BOTH days every week", async () => {
    // Two weekly schedules on different days is how twice-weekly is actually stored — one schedule
    // holds one weekday (app/api/recurring/route.ts).
    await makeSchedule("weekly", 2)
    await makeSchedule("weekly", 4)

    const dates = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 1 })
    const schedules = new Set(dates.map((d) => d.scheduleId))

    expect(schedules.size).toBe(2)
    // Both series run in parallel, so roughly twice as many dates as a single weekly schedule.
    expect(dates.length).toBeGreaterThan(6)
  })

  it("uses the SAME date maths as the job that really creates the bookings", async () => {
    // Not a re-implementation: projectRecurringDates calls addFrequencyInTZ, the generator's own
    // function. If these ever disagreed, the calendar would be advertising dates nobody is charged
    // for. Checked across a daylight-saving change, where naive 7-day arithmetic drifts an hour.
    const { next } = await makeSchedule("weekly", 2)

    const dates = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })
    const ordered = dates.filter((d) => d.scheduleId === dates[0].scheduleId).map((d) => d.at.getTime()).sort((a, b) => a - b)

    let expected = next
    for (const actual of ordered) {
      expect(actual).toBe(expected.getTime())
      expected = addFrequencyInTZ(expected, "weekly", "Europe/Berlin")
    }
  })

  it("monthly and fortnightly are spaced further apart than weekly", async () => {
    await makeSchedule("monthly", 2)
    const monthly = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })

    await client.query(`delete from recurring_schedules`)
    await makeSchedule("weekly", 2)
    const weekly = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })

    expect(weekly.length).toBeGreaterThan(monthly.length)
  })
})

describe("a planned date never duplicates a cleaning that is already booked", () => {
  it("drops the projected date once its real booking exists", async () => {
    const { next } = await makeSchedule("weekly", 2)

    const before = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })
    expect(before.some((d) => d.at.getTime() === next.getTime())).toBe(true)

    // The daily job has now turned the first one into a real booking.
    const after = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3, excludeTimes: [next] })

    expect(after.some((d) => d.at.getTime() === next.getTime())).toBe(false)
    expect(after.length).toBe(before.length - 1)   // only that one went
  })
})

describe("it cannot run away or show the past", () => {
  it("a schedule stuck in the past produces a bounded, future-only list", async () => {
    // A real failure mode the generator itself guards against. Walking it forward on every page
    // load must stay bounded, and must never draw last month as "planned".
    const past = new Date(Date.now() - 400 * 86_400_000)
    await client.query(
      `insert into recurring_schedules
         (customer_id, provider_id, service_id, frequency, day_of_week, preferred_time,
          service_address, timezone, status, next_booking_at)
       values ($1,$2,$3,'weekly',1,'10:00','{"line1":"x","city":"x","postalCode":"0","country":"DE"}'::jsonb,
          'Europe/Berlin','active',$4)`,
      [CUSTOMER_ID, PROVIDER_ID, SERVICE_ID, past],
    )

    // Captured BEFORE the call, deliberately. projectRecurringDates decides "is this in the
    // future?" against the clock when it STARTS, so comparing afterwards against a fresh Date.now()
    // makes the bound stricter than the code ever promised — and on a busy machine that gap grew
    // past a second and failed a date that was perfectly valid. The test was wrong, not the code.
    const before = Date.now()

    const dates = await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })

    expect(dates.length).toBeLessThanOrEqual(60)
    for (const d of dates) expect(d.at.getTime()).toBeGreaterThanOrEqual(before)
  })

  it("ignores paused and cancelled schedules", async () => {
    await makeSchedule("weekly", 2)
    await client.query(`update recurring_schedules set status = 'paused'`)

    expect(await projectRecurringDates({ customerId: CUSTOMER_ID, months: 3 })).toHaveLength(0)
  })

  it("returns nothing when asked about nobody", async () => {
    await makeSchedule("weekly", 2)
    expect(await projectRecurringDates({ months: 3 })).toHaveLength(0)
  })
})

describe("the cleaner sees their own recurring work too", () => {
  it("projects by cleaner, carrying the schedule through", async () => {
    await makeSchedule("weekly", 2)

    const dates = await projectRecurringDates({ providerId: PROVIDER_ID, months: 1 })

    expect(dates.length).toBeGreaterThan(2)
    expect(dates[0].timezone).toBe("Europe/Berlin")
  })
})
