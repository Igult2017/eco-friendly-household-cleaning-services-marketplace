import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { makeTestDb } from "../helpers/pgliteDb"

// The two routes that decide whether a cleaner can attempt their identity check at all, run against
// a real Postgres with the real schema. Stripe is stubbed, because the question here is what WE do
// with its answers — which is exactly where both defects lived:
//   1. every press of the button created a NEW Stripe check and spent one of two attempts, so two
//      accidental closes locked a cleaner out having been billed for nothing and checked nothing;
//   2. there was then no way back in: the only other code touching that table refuses to run for a
//      cleaner who has bookings, i.e. precisely the cleaner who needs help.

const { client, db } = await makeTestDb()
vi.doMock("@/lib/db", () => ({ db }))

const create = vi.fn()
const retrieve = vi.fn()
const cancel = vi.fn()
vi.doMock("@/lib/stripe/client", () => ({
  stripe: { identity: { verificationSessions: { create, retrieve, cancel } } },
  PLATFORM_FEE_PERCENT: 15,
}))

const authUserId = { current: "user_test_provider" }
vi.doMock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: authUserId.current }) }))
vi.doMock("@/lib/utils/logError", () => ({ logError: vi.fn() }))
// The admin guard is tested in its own right elsewhere; here it is the identity reset under test.
vi.doMock("@/lib/auth/requireAdmin", () => ({ requireAdmin: async () => ({ adminId: "user_admin" }) }))

const { POST: startSession } = await import("@/app/api/stripe/identity/session/route")
const { POST: resetIdentity } = await import("@/app/api/admin/providers/[id]/identity-reset/route")

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111"
const PROVIDER_USER_ID = "user_test_provider"

const callSession = () =>
  startSession(new Request("http://localhost/api/stripe/identity/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }))

const callReset = () =>
  resetIdentity(new Request("http://localhost/x", { method: "POST" }), {
    params: Promise.resolve({ id: PROVIDER_ID }),
  })

const attemptsRow = async () => {
  const r = await client.query<{ attempts: number; status: string; stripe_session_id: string | null }>(
    `select attempts, status, stripe_session_id from provider_identity_verifications where provider_id=$1`,
    [PROVIDER_ID],
  )
  return r.rows[0]
}

beforeAll(async () => {
  await client.query(`insert into users (id, email, first_name, last_name, role) values ($1,'cleaner@test.invalid','Test','Cleaner','provider')`, [PROVIDER_USER_ID])
  await client.query(`insert into providers (id, user_id, business_name, slug, country, verification_status) values ($1,$2,'Test Cleaner','test-cleaner','DE','not_started')`, [PROVIDER_ID, PROVIDER_USER_ID])
})

afterAll(async () => { await client.close() })

beforeEach(async () => {
  create.mockReset(); retrieve.mockReset(); cancel.mockReset()
  await client.query(`delete from provider_identity_verifications`)
  await client.query(`delete from notifications`)
  await client.query(`update providers set verification_status='not_started' where id=$1`, [PROVIDER_ID])
})

describe("opening the check twice must not cost a cleaner an attempt", () => {
  it("creates ONE Stripe check, then reuses it, and never increments attempts", async () => {
    create.mockResolvedValue({ id: "vs_first", client_secret: "secret_first" })
    retrieve.mockResolvedValue({ status: "requires_input", client_secret: "secret_first_again" })

    // First press — nothing exists yet, so a check is created.
    const first = await callSession()
    expect(first.status).toBe(200)
    expect((await first.json()).clientSecret).toBe("secret_first")
    expect(create).toHaveBeenCalledTimes(1)
    expect((await attemptsRow()).attempts).toBe(0)

    // Second press after closing the pop-up — Stripe's own guidance is to resume, not recreate.
    const second = await callSession()
    expect(second.status).toBe(200)
    expect((await second.json()).clientSecret).toBe("secret_first_again")
    expect(create).toHaveBeenCalledTimes(1)          // still one: nothing new was created
    expect(retrieve).toHaveBeenCalledWith("vs_first")
    expect((await attemptsRow()).attempts).toBe(0)   // and nothing was spent
  })

  it("creation is idempotency-keyed, so a double-submit cannot make two checks", async () => {
    create.mockResolvedValue({ id: "vs_x", client_secret: "s" })
    await callSession()
    const opts = create.mock.calls[0][1]
    expect(opts?.idempotencyKey).toBe(`identity-${PROVIDER_ID}-0`)
  })

  it("refuses once two SUBMITTED checks have been used, without calling Stripe", async () => {
    await client.query(
      `insert into provider_identity_verifications (provider_id, stripe_session_id, status, attempts) values ($1,'vs_old','requires_resubmission',2)`,
      [PROVIDER_ID],
    )
    const res = await callSession()

    expect(res.status).toBe(429)
    expect((await res.json()).attemptsExhausted).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(retrieve).not.toHaveBeenCalled()
  })

  it("settles it on the spot if Stripe already passed them but the webhook never landed", async () => {
    await client.query(
      `insert into provider_identity_verifications (provider_id, stripe_session_id, status, attempts) values ($1,'vs_done','pending',1)`,
      [PROVIDER_ID],
    )
    retrieve.mockResolvedValue({ status: "verified" })

    const res = await callSession()

    expect((await res.json()).alreadyVerified).toBe(true)
    const p = await client.query<{ verification_status: string }>(`select verification_status from providers where id=$1`, [PROVIDER_ID])
    expect(p.rows[0].verification_status).toBe("verified")
  })

  it("tells a cleaner their check is still being reviewed instead of starting another", async () => {
    await client.query(
      `insert into provider_identity_verifications (provider_id, stripe_session_id, status, attempts) values ($1,'vs_busy','processing',1)`,
      [PROVIDER_ID],
    )
    retrieve.mockResolvedValue({ status: "processing" })

    const res = await callSession()

    expect(res.status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })
})

describe("an admin can unstick a cleaner who ran out of attempts", () => {
  beforeEach(async () => {
    await client.query(
      `insert into provider_identity_verifications (provider_id, stripe_session_id, status, attempts) values ($1,'vs_spent','requires_resubmission',2)`,
      [PROVIDER_ID],
    )
  })

  it("resets the count so the cleaner can try again — the path that did not exist before", async () => {
    cancel.mockResolvedValue({})
    // Locked out to begin with.
    expect((await callSession()).status).toBe(429)

    const res = await callReset()
    expect(res.status).toBe(200)

    const row = await attemptsRow()
    expect(row.attempts).toBe(0)
    expect(row.status).toBe("not_started")
    expect(row.stripe_session_id).toBeNull()

    // And they really can start again.
    create.mockResolvedValue({ id: "vs_new", client_secret: "secret_new" })
    const after = await callSession()
    expect(after.status).toBe(200)
    expect((await after.json()).clientSecret).toBe("secret_new")
  })

  it("tells the cleaner, so the reset is not invisible to them", async () => {
    cancel.mockResolvedValue({})
    await callReset()

    const n = await client.query<{ user_id: string; title: string }>(`select user_id, title from notifications`)
    expect(n.rows).toHaveLength(1)
    expect(n.rows[0].user_id).toBe(PROVIDER_USER_ID)
    expect(n.rows[0].title).toMatch(/try your identity check again/i)
  })

  it("still resets when Stripe refuses to cancel the old check", async () => {
    // Cancelling is tidiness; the reset is the thing that unblocks a real person. A Stripe error
    // must not be allowed to leave them stuck.
    cancel.mockRejectedValue(new Error("cannot cancel a processing session"))

    expect((await callReset()).status).toBe(200)
    expect((await attemptsRow()).attempts).toBe(0)
  })

  it("refuses to reset a cleaner who has already passed", async () => {
    // Wiping a verified cleaner would send them back through a check you get billed for twice.
    await client.query(`update providers set verification_status='verified' where id=$1`, [PROVIDER_ID])

    const res = await callReset()

    expect(res.status).toBe(409)
    expect((await attemptsRow()).attempts).toBe(2)
  })
})
