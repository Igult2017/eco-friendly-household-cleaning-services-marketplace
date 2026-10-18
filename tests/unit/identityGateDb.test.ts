import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { makeTestDb } from "../helpers/pgliteDb"

// The identity gate, exercised against a REAL Postgres (PGlite) carrying the REAL production
// schema — every migration plus the ensure-script DDL, which is where identity_check_due_at is
// actually created. No stubbed database and no hand-written copy of the schema: the bug being
// guarded against here was "the gate never ran at all", and a fake database would have been
// perfectly happy to let that pass.
//
// This calls blockIfAwaitingIdentity, the exact function wired into
// app/api/bookings/[id]/{start,complete,no-show/client}.

const { client, db } = await makeTestDb()
vi.doMock("@/lib/db", () => ({ db }))

const { blockIfAwaitingIdentity, isAwaitingIdentity, clearIdentityHold } =
  await import("@/lib/bookings/identityGate")

// Signed in as the test cleaner, so the REAL route handler can be called end to end.
const authUserId = { current: "user_test_provider" }
vi.doMock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authUserId.current }) }))
vi.doMock("@/lib/utils/logError", () => ({ logError: vi.fn() }))

const { POST: startJob } = await import("@/app/api/bookings/[id]/start/route")

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111"
const CUSTOMER_ID = "user_test_customer"
const PROVIDER_USER_ID = "user_test_provider"

/** Inserts a booking and returns its id. `hold` sets the identity deadline. */
async function makeBooking(num: string, hold: Date | null): Promise<string> {
  const r = await client.query<{ id: string }>(
    `insert into bookings
       (booking_number, customer_id, provider_id, scheduled_at, scheduled_end_at,
        service_address, subtotal_amount, platform_fee_amount, total_amount, provider_payout,
        status, identity_check_due_at)
     values ($1,$2,$3, now() + interval '7 days', now() + interval '7 days 2 hours',
        '{"street":"1 Test St","city":"Testville","postalCode":"00000","country":"DE"}'::json,
        1000,150,1000,850,'confirmed',$4)
     returning id`,
    [num, CUSTOMER_ID, PROVIDER_ID, hold],
  )
  return r.rows[0].id
}

const setVerification = (status: string) =>
  client.query(`update providers set verification_status = $1 where id = $2`, [status, PROVIDER_ID])

beforeAll(async () => {
  await client.query(
    `insert into users (id, email, first_name, last_name, role) values ($1,$2,'Test','Client','customer'), ($3,$4,'Test','Cleaner','provider')`,
    [CUSTOMER_ID, "client@test.invalid", PROVIDER_USER_ID, "cleaner@test.invalid"],
  )
  await client.query(
    `insert into providers (id, user_id, business_name, slug, country, verification_status) values ($1,$2,'Test Cleaner','test-cleaner','DE','not_started')`,
    [PROVIDER_ID, PROVIDER_USER_ID],
  )
})

afterAll(async () => { await client.close() })

beforeEach(async () => {
  await client.query(`delete from bookings`)
  await setVerification("not_started")
})

describe("the gate refuses a cleaner who has not verified", () => {
  it("BLOCKS when the booking carries a hold and the cleaner is unverified", async () => {
    // Before the fix this returned nothing at all — isAwaitingIdentity had zero callers, so an
    // unverified cleaner could start the job, capture the card and claim a no-show fee.
    const id = await makeBooking("BK-T-001", new Date(Date.now() + 3_600_000))

    expect(await isAwaitingIdentity(id)).toBe(true)

    const blocked = await blockIfAwaitingIdentity(id)
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(403)

    const body = await blocked!.json()
    expect(body.identityRequired).toBe(true)
    expect(body.error).toMatch(/verify your identity/i)
  })

  it("still blocks AFTER the deadline has passed — an expired clock is not a free pass", async () => {
    const id = await makeBooking("BK-T-002", new Date(Date.now() - 3_600_000))
    expect(await isAwaitingIdentity(id)).toBe(true)
    expect(await blockIfAwaitingIdentity(id)).not.toBeNull()
  })
})

describe("the gate lets everyone else through", () => {
  it("ALLOWS a booking with no hold on it", async () => {
    // The guard is scoped to bookings that carry a hold, on purpose: keying it on "this cleaner is
    // unverified" would have frozen every booking made before the check existed.
    const id = await makeBooking("BK-T-003", null)
    expect(await isAwaitingIdentity(id)).toBe(false)
    expect(await blockIfAwaitingIdentity(id)).toBeNull()
  })

  it("ALLOWS a verified cleaner even if a stale hold was left behind", async () => {
    // This one matters: a leftover hold used to be harmless because nothing read it. Now it
    // refuses actions, so a cleaner who passed must never be caught by one.
    const id = await makeBooking("BK-T-004", new Date(Date.now() + 3_600_000))
    await setVerification("verified")

    expect(await isAwaitingIdentity(id)).toBe(false)
    expect(await blockIfAwaitingIdentity(id)).toBeNull()
  })

  it("ALLOWS once the hold is cleared, and clearing touches only held rows", async () => {
    const held = await makeBooking("BK-T-005", new Date(Date.now() + 3_600_000))
    const free = await makeBooking("BK-T-006", null)

    const released = await clearIdentityHold(PROVIDER_ID)

    expect(released).toEqual([held])          // exactly the held one, not both
    expect(await isAwaitingIdentity(held)).toBe(false)
    expect(await isAwaitingIdentity(free)).toBe(false)
  })

  it("does not block a booking that does not exist", async () => {
    expect(await isAwaitingIdentity("22222222-2222-2222-2222-222222222222")).toBe(false)
  })
})

describe("the REAL /start route, end to end", () => {
  const callStart = (id: string) =>
    startJob(new Request("http://localhost/api/bookings/x/start", { method: "POST" }), {
      params: Promise.resolve({ id }),
    })

  it("refuses to mark an unverified cleaner as arrived at the client's home", async () => {
    // The whole point of the feature, exercised through the actual handler rather than inferred
    // from the fact that it imports the guard.
    const id = await makeBooking("BK-T-010", new Date(Date.now() + 3_600_000))

    const res = await callStart(id)

    expect(res.status).toBe(403)
    expect((await res.json()).identityRequired).toBe(true)

    // And it refused BEFORE changing anything — the booking must not be half-started.
    const r = await client.query<{ status: string }>(`select status from bookings where id=$1`, [id])
    expect(r.rows[0].status).toBe("confirmed")
  })

  it("lets the same cleaner start the same job the moment they are verified", async () => {
    const id = await makeBooking("BK-T-011", new Date(Date.now() + 3_600_000))
    expect((await callStart(id)).status).toBe(403)

    await setVerification("verified")

    const res = await callStart(id)
    expect(res.status).toBe(200)

    const r = await client.query<{ status: string }>(`select status from bookings where id=$1`, [id])
    expect(r.rows[0].status).toBe("in_progress")
  })

  it("lets a cleaner start a job that never carried a hold", async () => {
    const id = await makeBooking("BK-T-012", null)
    expect((await callStart(id)).status).toBe(200)
  })
})

describe("the database itself enforces what we assumed", () => {
  it("verification_status genuinely has no 'processing' value", async () => {
    // The reason refreshIdentityStatus stores "pending" for a check Stripe is still judging.
    // Asserted against the real enum rather than taken on trust.
    const r = await client.query<{ enumlabel: string }>(
      `select enumlabel from pg_enum join pg_type t on t.oid = enumtypid
        where t.typname = 'verification_status' order by enumsortorder`,
    )
    const values = r.rows.map((x) => x.enumlabel)
    expect(values).toEqual(["not_started", "pending", "verified", "rejected", "requires_resubmission"])
    expect(values).not.toContain("processing")
  })

  it("a payment intent id can only be used once, which is what makes reassignment safe", async () => {
    // attemptReassign now looks up payments by the new intent id and returns the existing booking
    // instead of inserting a second one. That guard only means anything because this index exists.
    const r = await client.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = 'payments' and indexdef ilike '%unique%stripe_payment_intent_id%'`,
    )
    expect(r.rows.length).toBeGreaterThan(0)
  })
})
