import { describe, it, expect, vi, beforeEach } from "vitest"

// The database is stubbed per-test so each case states exactly the situation it describes: whether a
// recurring arrangement exists between this client and this cleaner, and how many jobs they have
// already delivered together.
let scheduleRows: unknown[] = []
let jobCount = 0

vi.mock("@/lib/db", () => ({
  db: {
    select: (shape?: Record<string, unknown>) => ({
      from: () => ({
        where: (..._a: unknown[]) => {
          const isCount = shape && "n" in shape
          const result = isCount ? [{ n: jobCount }] : scheduleRows
          // The schedule lookup chains .limit(); the count does not.
          return Object.assign(Promise.resolve(result), { limit: () => Promise.resolve(result) })
        },
      }),
    }),
  },
}))

vi.mock("@/lib/platform/settings", () => ({
  getCommissionPct: async () => 45,
  getRegularClientCommissionPct: async () => 33,
  getRegularClientAfterJobs: async () => 3,
}))

const { resolveCommissionPct } = await import("@/lib/platform/commissionTier")

const PAIR = { customerId: "user_1", providerId: "prov_1" }

beforeEach(() => { scheduleRows = []; jobCount = 0 })

describe("resolveCommissionPct — one-off vs regular client", () => {
  it("a one-off client pays the standard rate: cleaner keeps 55%", async () => {
    const r = await resolveCommissionPct(PAIR)
    expect(r.pct).toBe(45)
    expect(r.reason).toBe("one_off")
  })

  it("booking the same cleaner again, with no repeating arrangement, is still a one-off", async () => {
    jobCount = 9 // they have worked together a lot, but never set up a schedule
    const r = await resolveCommissionPct(PAIR)
    expect(r.pct).toBe(45)
    expect(r.reason).toBe("one_off")
  })

  it("a regular client's first 3 jobs are still at the standard rate", async () => {
    scheduleRows = [{ id: "sched_1" }]
    for (const prior of [0, 1, 2]) {
      jobCount = prior
      const r = await resolveCommissionPct(PAIR)
      expect(r.pct, `after ${prior} prior jobs`).toBe(45)
      expect(r.reason).toBe("regular_early")
    }
  })

  it("the 4th job onwards drops to the reduced rate: cleaner keeps 67%", async () => {
    scheduleRows = [{ id: "sched_1" }]
    for (const prior of [3, 4, 20]) {
      jobCount = prior
      const r = await resolveCommissionPct(PAIR)
      expect(r.pct, `after ${prior} prior jobs`).toBe(33)
      expect(r.reason).toBe("regular_established")
    }
  })

  it("a booking made as recurring counts as regular even before any schedule row exists", async () => {
    jobCount = 5
    const r = await resolveCommissionPct({ ...PAIR, isRecurring: true })
    expect(r.pct).toBe(33)
    expect(r.reason).toBe("regular_established")
  })

  it("on a €100 job the cleaner receives €55 one-off and €67 as an established regular", async () => {
    const oneOff = await resolveCommissionPct(PAIR)
    scheduleRows = [{ id: "sched_1" }]
    jobCount = 3
    const established = await resolveCommissionPct(PAIR)
    expect(10000 - Math.round(10000 * oneOff.pct / 100)).toBe(5500)
    expect(10000 - Math.round(10000 * established.pct / 100)).toBe(6700)
  })
})
