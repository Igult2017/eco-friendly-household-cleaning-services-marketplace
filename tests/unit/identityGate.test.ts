import { describe, it, expect, vi, beforeEach } from "vitest"

// The identity check a cleaner must pass after being awarded their first job. These tests pin the
// DECISIONS, because every one of them was wrong at some point today and each wrong answer costs a
// real person something: a cleaner loses work they earned, or an unverified stranger is waved into
// a client's home.
//
// Stripe is stubbed at the module boundary, like tests/unit/resolveHold.test.ts — the question here
// is how we INTERPRET what Stripe says, which is exactly where the defects lived.

const retrieve = vi.fn()
vi.mock("@/lib/stripe/client", () => ({
  stripe: { identity: { verificationSessions: { retrieve: (...a: unknown[]) => retrieve(...a) } } },
  PLATFORM_FEE_PERCENT: 15,
}))

// Minimal database stand-in. refreshIdentityStatus always reads the provider FIRST and the
// verification record SECOND, so the mock answers by call order rather than by inspecting
// Drizzle's internals — which is both simpler and not coupled to Drizzle's private shape.
const writes: Array<Record<string, unknown>> = []
let selectCalls = 0
let providerRow: { status: string } | undefined
let verificationRow: { sessionId: string | null } | undefined

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const nth = ++selectCalls
      return {
        from: () => ({
          where: () =>
            nth === 1
              ? Promise.resolve(providerRow ? [{ status: providerRow.status }] : [])
              : Promise.resolve(verificationRow ? [verificationRow] : []),
        }),
      }
    },
    update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => { writes.push(v); return Promise.resolve() } }) }),
  },
}))

const clearIdentityHold = vi.fn(async () => ["booking-1"])
vi.mock("@/lib/bookings/identityGate", () => ({ clearIdentityHold: () => clearIdentityHold() }))
vi.mock("@/lib/utils/logError", () => ({ logError: vi.fn() }))

const { refreshIdentityStatus, mapStripeStatus } = await import("@/lib/stripe/identityStatus")

beforeEach(() => {
  retrieve.mockReset()
  clearIdentityHold.mockClear()
  writes.length = 0
  selectCalls = 0
  providerRow = { status: "pending" }
  verificationRow = { sessionId: "vs_test_123" }
})

describe("what Stripe's answer means to us", () => {
  it("'processing' is its own state — NOT a failure", () => {
    // The whole point: a cleaner whose documents are submitted and being judged must not be
    // lumped in with one who never tried. The sweeper uses this to leave the job alone.
    expect(mapStripeStatus("processing")).toBe("processing")
  })

  it("'requires_input' means they must try again, not that they are mid-check", () => {
    expect(mapStripeStatus("requires_input")).toBe("requires_resubmission")
  })

  it("'verified' is verified, and 'canceled' puts them back to the start", () => {
    expect(mapStripeStatus("verified")).toBe("verified")
    expect(mapStripeStatus("canceled")).toBe("not_started")
  })

  it("an unrecognised status is never read as verified", () => {
    // Fail closed. A status we do not understand must never be the reason someone is waved
    // through an identity check.
    expect(mapStripeStatus("something_stripe_added_later")).not.toBe("verified")
  })
})

describe("a Stripe outage must never cost a cleaner their job", () => {
  it("reports live:false and changes NOTHING when Stripe throws", async () => {
    retrieve.mockRejectedValue(new Error("stripe is down"))

    const result = await refreshIdentityStatus("prov-1")

    expect(result.live).toBe(false)
    expect(result.status).toBe("pending")   // the stored value, untouched
    expect(writes).toHaveLength(0)          // nothing written
    expect(clearIdentityHold).not.toHaveBeenCalled()
  })

  it("reports live:false when Stripe is merely slow, rather than guessing", async () => {
    retrieve.mockImplementation(() => new Promise((r) => setTimeout(r, 10_000)))

    const result = await refreshIdentityStatus("prov-1")

    expect(result.live).toBe(false)
    expect(result.status).toBe("pending")
    // The code gives up on Stripe after 5s, so this resolves well inside the budget. The budget is
    // generous on purpose: when the whole suite runs at once the machine is busy, and a test that
    // fails only under load is worse than no test — it teaches people to re-run and ignore it.
  }, 30_000)
})

describe("a cleaner who passed is released even if the webhook never arrived", () => {
  it("clears the hold on every waiting job when Stripe says verified", async () => {
    // This is the failure that mattered most: the ONLY route from "Stripe says verified" into our
    // database used to be the webhook. One missed delivery and the deadline sweeper took the job
    // away from the one person who had done everything asked of them.
    retrieve.mockResolvedValue({ status: "verified" })

    const result = await refreshIdentityStatus("prov-1")

    expect(result.status).toBe("verified")
    expect(result.live).toBe(true)
    expect(clearIdentityHold).toHaveBeenCalledTimes(1)
    expect(result.releasedBookingIds).toEqual(["booking-1"])
  })

  it("does NOT release anything while Stripe is still deciding", async () => {
    retrieve.mockResolvedValue({ status: "processing" })

    const result = await refreshIdentityStatus("prov-1")

    expect(result.status).toBe("processing")
    expect(clearIdentityHold).not.toHaveBeenCalled()
  })

  it("stores 'pending' for processing, because the provider column is an enum without it", async () => {
    retrieve.mockResolvedValue({ status: "processing" })

    await refreshIdentityStatus("prov-1")

    // providers.verificationStatus is a Postgres enum with no "processing" value. Writing the raw
    // word there would throw at runtime — the behaviour is carried by the returned value instead.
    const providerWrite = writes.find((w) => "verificationStatus" in w)
    expect(providerWrite?.verificationStatus).toBe("pending")
    expect(providerWrite?.verificationStatus).not.toBe("processing")
  })
})

describe("spending nothing when there is nothing to ask", () => {
  it("never calls Stripe for a cleaner who is already verified", async () => {
    providerRow = { status: "verified" }

    const result = await refreshIdentityStatus("prov-1")

    expect(retrieve).not.toHaveBeenCalled()
    expect(result.status).toBe("verified")
  })

  it("never calls Stripe for a cleaner who has never started a check", async () => {
    verificationRow = undefined

    const result = await refreshIdentityStatus("prov-1")

    expect(retrieve).not.toHaveBeenCalled()
    expect(result.live).toBe(true)
  })
})
