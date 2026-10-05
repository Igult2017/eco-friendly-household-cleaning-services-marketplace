"use client"

import { Config, SetFn, blurOnWheel, INPUT_CLS, euros } from "./shared"

// Commission + the wage floor. Both are "what everyone actually earns" settings, so each one shows a
// worked example on €100 that recalculates from whatever is on screen right now, including unsaved
// edits — the number the admin is looking at can never disagree with the number that will be saved.
export function MoneySection({ cfg, set }: { cfg: Config; set: SetFn }) {
  const standard = parseInt(cfg.commission_pct ?? "45") || 0
  const regular = parseInt(cfg.commission_regular_pct ?? "33") || 0
  const afterJobs = parseInt(cfg.commission_regular_after_jobs ?? "3") || 0

  return (
    <>
      {/* Commission — two rates */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Platform Commission %</label>
        <p className="text-xs text-[#6B7280] mb-4">
          Deducted from the cleaner&apos;s payout (the cleaner pays this to use the platform). The
          customer pays the cleaner&apos;s rate — nothing is added on top. A <strong>regular</strong> client
          (one on a repeating arrangement with that cleaner) earns their cleaner a bigger share once
          they&apos;ve worked together a few times. Changing these only affects new bookings — existing
          bookings keep the rate they were created with.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">One-off client</label>
            <input type="number" min={0} max={60} value={cfg.commission_pct ?? "45"}
              onChange={e => set("commission_pct", e.target.value)} onWheel={blurOnWheel}
              className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">Cleaner keeps {100 - standard}%</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Established regular</label>
            <input type="number" min={0} max={60} value={cfg.commission_regular_pct ?? "33"}
              onChange={e => set("commission_regular_pct", e.target.value)} onWheel={blurOnWheel}
              className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">Cleaner keeps {100 - regular}%</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">After this many jobs</label>
            <input type="number" min={0} max={50} value={cfg.commission_regular_after_jobs ?? "3"}
              onChange={e => set("commission_regular_after_jobs", e.target.value)} onWheel={blurOnWheel}
              className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">Together, that client &amp; cleaner</p>
          </div>
        </div>

        <div className="bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs text-[#2B3441] space-y-1">
          <p className="font-semibold mb-1">On a €100 job, the cleaner receives:</p>
          <p>One-off client — <span className="font-semibold text-[#2D7A5F]">€{100 - standard}</span> (platform keeps €{standard})</p>
          <p>Regular client, jobs 1–{afterJobs} — <span className="font-semibold text-[#2D7A5F]">€{100 - standard}</span> (platform keeps €{standard})</p>
          <p>Regular client, job {afterJobs + 1} onwards — <span className="font-semibold text-[#2D7A5F]">€{100 - regular}</span> (platform keeps €{regular})</p>
        </div>
      </div>

      {/* Minimum wage floor */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Minimum Hourly Rate (€ cents)</label>
        <p className="text-xs text-[#6B7280] mb-3">
          Applies wherever an hourly rate is set on either side of the marketplace — a client posting a
          job, or a cleaner listing a per-hour service. Neither can go below this. One flat number for
          both the EUR and USD markets (same as travel compensation below).
        </p>
        <div className="flex items-center gap-3">
          <input type="number" min={0} max={100000} value={cfg.min_hourly_rate_cents ?? "1800"}
            onChange={e => set("min_hourly_rate_cents", e.target.value)} onWheel={blurOnWheel}
            className={`w-32 ${INPUT_CLS}`} />
          {/* Follows the box. This label used to be hardcoded to "1500 = €15.00/hr" and never
              changed, so the field could read 1800 while the label still insisted it was 1500. */}
          <span className="text-sm text-[#6B7280]">
            = {euros(cfg.min_hourly_rate_cents, 1800)}/hr
          </span>
        </div>
      </div>
    </>
  )
}
