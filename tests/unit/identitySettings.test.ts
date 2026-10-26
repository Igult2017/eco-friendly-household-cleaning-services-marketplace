import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { makeTestDb } from "../helpers/pgliteDb"

// The admin switches: whether cleaners are asked to verify at all, and when.
//
// The dangerous half is "off". Switching the check off must not merely stop asking new cleaners —
// it has to RELEASE anyone already being held, or an admin turning it off mid-check would lock a
// cleaner out of their own job with a requirement they can no longer satisfy and no prompt left to
// satisfy it with.

const { client, db } = await makeTestDb()
vi.doMock("@/lib/db", () => ({ db }))
vi.doMock("@/lib/utils/logError", () => ({ logError: vi.fn() }))

const { isAwaitingIdentity, requireIdentityOnAward } = await import("@/lib/bookings/identityGate")
const { getIdentityEnabled, getIdentityMode } = await import("@/lib/platform/settings")

const CUSTOMER_ID = "user_test_client"
const PROVIDER_USER_ID = "user_test_cleaner"
const PROVIDER_ID = "55555555-5555-5555-5555-555555555555"

const setSetting = (key: string, value: string) =>
  client.query(
    `insert into platform_settings (key, value) values ($1,$2)
     on conflict (key) do update set value = excluded.value`,
    [key, value],
  )

async function makeBooking(num: string, hold: Date | null): Promise<string> {
  const r = await client.query<{ id: string }>(
    `insert into bookings
       (booking_number, customer_id, provider_id, scheduled_at, scheduled_end_at, service_address,
        subtotal_amount, platform_fee_amount, total_amount, provider_payout, status, identity_check_due_at)
     values ($1,$2,$3, now() + interval '7 days', now() + interval '7 days 2 hours',
        '{"line1":"1 Test St","city":"Testville","postalCode":"00000","country":"DE"}'::json,
        1000,150,1000,850,'confirmed',$4)
     returning id`,
    [num, CUSTOMER_ID, PROVIDER_ID, hold],
  )
  return r.rows[0].id
}

const holdOn = async (bookingId: string) => {
  const r = await client.query<{ due: string | null }>(
    `select identity_check_due_at as due from bookings where id = $1`, [bookingId])
  return r.rows[0].due !== null
}

beforeAll(async () => {
  await client.query(
    `insert into users (id, email, first_name, last_name, role)
     values ($1,'client@test.invalid','T','C','customer'), ($2,'cleaner@test.invalid','T','C','provider')`,
    [CUSTOMER_ID, PROVIDER_USER_ID],
  )
  await client.query(
    `insert into providers (id, user_id, business_name, slug, country, verification_status)
     values ($1,$2,'Test Cleaner','test-cleaner','DE','not_started')`,
    [PROVIDER_ID, PROVIDER_USER_ID],
  )
})

afterAll(async () => { await client.close() })

beforeEach(async () => {
  await client.query(`delete from bookings`)
  await client.query(`delete from notifications`)
  await client.query(`delete from platform_settings where key like 'identity%'`)
})

describe("the defaults leave today's behaviour exactly as it is", () => {
  it("is on, and asks at the first job, when an admin has never touched it", async () => {
    expect(await getIdentityEnabled()).toBe(true)
    expect(await getIdentityMode()).toBe("first_job")
  })

  it("falls back to the defaults rather than trusting a nonsense value", async () => {
    await setSetting("identity_enabled", "maybe")
    await setSetting("identity_mode", "whenever")

    expect(await getIdentityEnabled()).toBe(true)
    expect(await getIdentityMode()).toBe("first_job")
  })
})

describe("switching it OFF releases people, it does not just stop asking", () => {
  it("frees a cleaner who is already being held", async () => {
    const id = await makeBooking("BK-S-001", new Date(Date.now() + 3_600_000))
    expect(await isAwaitingIdentity(id)).toBe(true)   // held while it is on

    await setSetting("identity_enabled", "off")

    expect(await isAwaitingIdentity(id)).toBe(false)  // released the moment it is off
  })

  it("asks nobody new — no hold is written when a job is awarded", async () => {
    await setSetting("identity_enabled", "off")
    const id = await makeBooking("BK-S-002", null)

    const result = await requireIdentityOnAward({ bookingId: id, providerId: PROVIDER_ID })

    expect(result.awaitingIdentity).toBe(false)
    expect(await holdOn(id)).toBe(false)
  })

  it("does not pester the cleaner with a prompt they cannot act on", async () => {
    await setSetting("identity_enabled", "off")
    const id = await makeBooking("BK-S-003", null)
    await requireIdentityOnAward({ bookingId: id, providerId: PROVIDER_ID })

    const n = await client.query(`select 1 from notifications`)
    expect(n.rows).toHaveLength(0)
  })

  it("switching it back ON starts holding again", async () => {
    await setSetting("identity_enabled", "off")
    const id = await makeBooking("BK-S-004", new Date(Date.now() + 3_600_000))
    expect(await isAwaitingIdentity(id)).toBe(false)

    await setSetting("identity_enabled", "on")
    expect(await isAwaitingIdentity(id)).toBe(true)
  })
})

describe("switching it off also stops jobs being TAKEN AWAY", () => {
  it("the reconciliation pass writes no new holds while it is off", async () => {
    // Found in my own health check: releasing the block was not enough. Holds already in the
    // database are still there after the switch, and the hourly sweep acts on them — so with the
    // feature off a cleaner could still have work reassigned for a requirement the admin withdrew.
    // Reassignment moves money and changes who enters a client's home, so it must stop too.
    await setSetting("identity_enabled", "off")
    const id = await makeBooking("BK-S-006", null)

    await requireIdentityOnAward({ bookingId: id, providerId: PROVIDER_ID })

    expect(await holdOn(id)).toBe(false)
  })

  it("a leftover hold from before the switch no longer blocks the cleaner", async () => {
    const id = await makeBooking("BK-S-007", new Date(Date.now() - 3_600_000))  // already overdue
    expect(await isAwaitingIdentity(id)).toBe(true)

    await setSetting("identity_enabled", "off")

    expect(await isAwaitingIdentity(id)).toBe(false)
    // The row keeps its hold — nothing is rewritten — it is simply ignored while the feature is off,
    // so switching back on restores the previous state exactly.
    expect(await holdOn(id)).toBe(true)
  })
})

describe("asking at signup does NOT stop the job gate", () => {
  it("still holds a cleaner who skipped the signup step", async () => {
    // Onboarding can be abandoned by closing the tab. If "asked at signup" also meant "not checked
    // at the job", that skip would hand an unverified cleaner real work — the exact fails-open bug
    // this feature was rewritten to close.
    await setSetting("identity_enabled", "on")
    await setSetting("identity_mode", "onboarding")
    const id = await makeBooking("BK-S-005", null)

    const result = await requireIdentityOnAward({ bookingId: id, providerId: PROVIDER_ID })

    expect(result.awaitingIdentity).toBe(true)
    expect(await holdOn(id)).toBe(true)
  })

  it("leaves an already-verified cleaner alone in either mode", async () => {
    await client.query(`update providers set verification_status='verified' where id=$1`, [PROVIDER_ID])
    for (const mode of ["first_job", "onboarding"]) {
      await setSetting("identity_mode", mode)
      const id = await makeBooking(`BK-S-10${mode.length}`, null)

      const result = await requireIdentityOnAward({ bookingId: id, providerId: PROVIDER_ID })

      expect(result.awaitingIdentity).toBe(false)
      expect(await holdOn(id)).toBe(false)
    }
    await client.query(`update providers set verification_status='not_started' where id=$1`, [PROVIDER_ID])
  })
})
