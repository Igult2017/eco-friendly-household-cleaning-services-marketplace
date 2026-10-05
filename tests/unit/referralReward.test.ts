import { describe, it, expect, vi, beforeEach } from "vitest"

// Scenario the test sets up before each case.
const scene = {
  referral: null as null | { id: string; referrerId: string; referredId: string; status: string },
  referralIsPending: false,
  referrerRole: "customer" as "customer" | "provider" | "affiliate",
  alreadyPaidRows: 0,   // how many rows for this referral already carry a reward
  jobsCounted: 1,       // how many bookings have been counted, INCLUDING the one just claimed
  claimAccepted: true,  // false = this booking was already counted (a retry)
}
const updates: { table: string; set: Record<string, unknown> }[] = []

// The select() calls are told apart by the shape they ask for, so the mock does not depend on the
// ORDER the function happens to run them in.
vi.mock("@/lib/db", () => {
  const rows = (r: unknown[]) => Object.assign(Promise.resolve(r), { limit: () => Promise.resolve(r) })
  return {
    db: {
      select: (shape?: Record<string, unknown>) => ({
        from: () => ({
          where: () => {
            if (shape && "role" in shape) return rows([{ role: scene.referrerRole }])
            if (shape && "paid" in shape) return rows([{ paid: scene.alreadyPaidRows }])
            if (shape && "jobs" in shape) return rows([{ jobs: scene.jobsCounted }])
            // No shape → the referrals lookup. The function asks for "pending" first, then "active".
            if (!scene.referral) return rows([])
            return rows(scene.referralIsPending ? [scene.referral] : [])
          },
        }),
      }),
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve(scene.claimAccepted ? [{ id: "rc_new" }] : []),
          }),
        }),
      }),
      update: (table: { _: { name?: string } } | unknown) => ({
        set: (set: Record<string, unknown>) => ({
          where: () => {
            updates.push({ table: String((table as { _?: { name?: string } })?._?.name ?? "unknown"), set })
            return Promise.resolve()
          },
        }),
      }),
    },
  }
})

vi.mock("@/lib/platform/settings", () => ({
  getReferralRewardCents: async () => 2500,
  getReferralJobsRequired: async (isProviderSide: boolean) => (isProviderSide ? 2 : 1),
  getAffiliateCommissionPct: async () => 5,
}))

const { creditReferralReward } = await import("@/lib/referrals/rewards")

// The "active" lookup is a second query with no shape; make it resolve when not pending.
function activeReferral(referrerRole: typeof scene.referrerRole) {
  scene.referral = { id: "ref_1", referrerId: "user_referrer", referredId: "user_referred", status: "active" }
  scene.referralIsPending = true // served by the first (pending) lookup — same row either way
  scene.referrerRole = referrerRole
}

const call = (isProviderSide: boolean) =>
  creditReferralReward({ referredUserId: "user_referred", bookingId: "bk_1", subtotalCents: 10000, isProviderSide })

beforeEach(() => {
  updates.length = 0
  scene.referral = null
  scene.referralIsPending = false
  scene.referrerRole = "customer"
  scene.alreadyPaidRows = 0
  scene.jobsCounted = 1
  scene.claimAccepted = true
})

describe("creditReferralReward — one flat €25, paid once", () => {
  it("pays nothing when nobody referred this person", async () => {
    expect(await call(false)).toEqual({ skipped: "no_referral" })
  })

  it("a referred CLEANER earns nothing on their 1st job", async () => {
    activeReferral("provider")
    scene.jobsCounted = 1
    const r = await call(true)
    expect(r).toMatchObject({ skipped: "threshold_not_reached", jobsSoFar: 1, jobsRequired: 2 })
  })

  it("a referred CLEANER earns exactly €25 on their 2nd job", async () => {
    activeReferral("provider")
    scene.jobsCounted = 2
    const r = await call(true)
    expect(r).toEqual({ commissionCents: 2500, referrerId: "user_referrer", rewardType: "commission" })
  })

  it("a referred CLIENT earns €25 on their 1st completed booking", async () => {
    activeReferral("customer")
    scene.jobsCounted = 1
    const r = await call(false)
    expect(r).toEqual({ commissionCents: 2500, referrerId: "user_referrer", rewardType: "discount" })
  })

  it("is never paid twice — a later booking earns nothing once the reward has been given", async () => {
    activeReferral("provider")
    scene.jobsCounted = 5
    scene.alreadyPaidRows = 1
    expect(await call(true)).toEqual({ skipped: "reward_already_paid" })
  })

  it("the same booking counted twice (a retry) changes nothing", async () => {
    activeReferral("provider")
    scene.claimAccepted = false
    expect(await call(true)).toEqual({ skipped: "already_counted" })
    // Nothing was written — the old bug was totals moving before the idempotency guard.
    expect(updates).toHaveLength(0)
  })

  it("an AFFILIATE still earns a percentage of every booking, not the flat reward", async () => {
    activeReferral("affiliate")
    scene.jobsCounted = 1
    const r = await call(false)
    // 5% of €100 = €5, on this booking and every later one.
    expect(r).toEqual({ commissionCents: 500, referrerId: "user_referrer", rewardType: "discount" })
  })

  it("an affiliate is paid again on a later booking, unlike a flat-reward referrer", async () => {
    activeReferral("affiliate")
    scene.alreadyPaidRows = 3 // earlier bookings already paid
    scene.jobsCounted = 4
    const r = await call(false)
    expect(r).toMatchObject({ commissionCents: 500 })
  })
})
