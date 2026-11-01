import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { makeTestDb } from "../helpers/pgliteDb"

// The switch that lets the owner test his own platform without hiring a real person.
//
// A flagged account may bid on and be booked for its own jobs. That lifts three job-board checks —
// same person, same internet connection, and distance — and NOTHING else. The danger is obvious:
// these are anti-fraud checks, so the tests below care as much about an UNFLAGGED account still
// being refused as about a flagged one getting through.

const { client, db } = await makeTestDb()
vi.doMock("@/lib/db", () => ({ db }))

const { isTestParticipant, isTestAccount } = await import("@/lib/testing/testAccount")

const CLIENT_ID = "user_client_real"
const CLEANER_ID = "user_cleaner_real"
const OUTSIDER_ID = "user_outsider"

const setTest = (id: string, on: boolean) =>
  client.query(`update users set is_test_account = $1 where id = $2`, [on, id])

beforeAll(async () => {
  await client.query(
    `insert into users (id, email, first_name, last_name, role) values
       ($1,'client@test.invalid','T','C','customer'),
       ($2,'cleaner@test.invalid','T','C','provider'),
       ($3,'outsider@test.invalid','T','O','customer')`,
    [CLIENT_ID, CLEANER_ID, OUTSIDER_ID],
  )
})

afterAll(async () => { await client.close() })

beforeEach(async () => { await client.query(`update users set is_test_account = false`) })

describe("by default nobody is a test account — protections stay on", () => {
  it("refuses when neither side is flagged", async () => {
    // The important half. If this ever returns true by default, every anti-fraud check on the job
    // board quietly stops working for everyone.
    expect(await isTestParticipant([CLIENT_ID, CLEANER_ID])).toBe(false)
  })

  it("a brand-new account is not a test account", async () => {
    const r = await client.query<{ is_test_account: boolean }>(
      `select is_test_account from users where id = $1`, [CLIENT_ID])
    expect(r.rows[0].is_test_account).toBe(false)
  })
})

describe("one flagged side is enough", () => {
  it("passes when only the CLIENT is flagged", async () => {
    await setTest(CLIENT_ID, true)
    expect(await isTestParticipant([CLIENT_ID, CLEANER_ID])).toBe(true)
  })

  it("passes when only the CLEANER is flagged", async () => {
    await setTest(CLEANER_ID, true)
    expect(await isTestParticipant([CLIENT_ID, CLEANER_ID])).toBe(true)
  })

  it("passes when the same person is both sides — one account, if he prefers", async () => {
    await setTest(CLIENT_ID, true)
    expect(await isTestParticipant([CLIENT_ID, CLIENT_ID])).toBe(true)
  })

  it("does NOT leak to an unrelated pair just because someone else is flagged", async () => {
    await setTest(CLIENT_ID, true)
    expect(await isTestParticipant([OUTSIDER_ID, CLEANER_ID])).toBe(false)
  })
})

describe("it cannot be tripped by bad input", () => {
  it("treats missing or empty ids as not-a-test", async () => {
    await setTest(CLIENT_ID, true)
    expect(await isTestParticipant([])).toBe(false)
    expect(await isTestParticipant([null, undefined])).toBe(false)
    expect(await isTestParticipant([""])).toBe(false)
  })

  it("an unknown id is not a test account", async () => {
    expect(await isTestParticipant(["user_does_not_exist"])).toBe(false)
  })

  it("isTestAccount answers for a single account", async () => {
    expect(await isTestAccount(CLEANER_ID)).toBe(false)
    await setTest(CLEANER_ID, true)
    expect(await isTestAccount(CLEANER_ID)).toBe(true)
  })
})

describe("turning the switch off restores the protections", () => {
  it("stops being a test account the moment it is cleared", async () => {
    await setTest(CLIENT_ID, true)
    expect(await isTestParticipant([CLIENT_ID, CLEANER_ID])).toBe(true)

    await setTest(CLIENT_ID, false)
    expect(await isTestParticipant([CLIENT_ID, CLEANER_ID])).toBe(false)
  })
})

describe("test bookings are kept out of the real numbers", () => {
  it("the bookings table can mark a booking as a test, defaulting to false", async () => {
    // Without this the owner's own testing would inflate the revenue figures he relies on —
    // trading one problem for a worse one.
    const r = await client.query<{ column_default: string; is_nullable: string }>(
      `select column_default, is_nullable from information_schema.columns
        where table_name = 'bookings' and column_name = 'is_test'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].column_default).toContain("false")
    expect(r.rows[0].is_nullable).toBe("NO")
  })
})
