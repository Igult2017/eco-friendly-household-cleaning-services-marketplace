"use client"

import { Config, SetFn, blurOnWheel, INPUT_CLS, euros } from "./shared"

// Payout schedule, service radius, and the cancellation / no-show policy.
export function OperationsSection({ cfg, set }: { cfg: Config; set: SetFn }) {
  const t1 = cfg.cancel_tier1_hours ?? "48"
  const t2 = cfg.cancel_tier2_hours ?? "24"
  const t3 = cfg.cancel_tier3_hours ?? "2"
  const low = cfg.cancel_fee_low_pct ?? "50"
  const med = cfg.cancel_fee_medium_pct ?? "100"
  const late = cfg.cancel_fee_late_pct ?? "100"

  return (
    <>
      {/* Payout schedule */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Default Payout Schedule</label>
        <p className="text-xs text-[#6B7280] mb-3">
          How often a newly set-up cleaner&apos;s payout account pays into their bank. Only applies to
          accounts set up AFTER this is changed — it does not retroactively move a cleaner who has
          already been set up.
        </p>
        <select
          value={cfg.payout_schedule ?? "weekly"}
          onChange={e => set("payout_schedule", e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
        >
          <option value="weekly">Weekly (Monday)</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Shortest booking. Replaces the old "Maximum Service Radius" box — cleaners now set any
          radius they like, so that control no longer changed anything and was removed. */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Shortest Booking (minutes)</label>
        <p className="text-xs text-[#6B7280] mb-3">
          The shortest visit anyone can book. Applies to <strong>both</strong> ways work is arranged —
          booking a cleaner directly and posting a job for bids — so neither is a way around the other.
          120 = 2 hours.
        </p>
        <div className="flex items-center gap-3">
          <input type="number" min={15} max={480} step={15} value={cfg.min_booking_minutes ?? "120"}
            onChange={e => set("min_booking_minutes", e.target.value)} onWheel={blurOnWheel}
            className={`w-24 ${INPUT_CLS}`} />
          <span className="text-sm text-[#6B7280]">
            = {((parseInt(cfg.min_booking_minutes ?? "120", 10) || 0) / 60).toFixed(1).replace(/\.0$/, "")} hours
          </span>
        </div>
      </div>

      {/* Cancellation & no-show policy */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Cancellation &amp; No-Show Policy</label>
        <p className="text-xs text-[#6B7280] mb-4">
          The same ladder applies to <strong>both sides</strong>. When a client cancels late the fee is
          taken from their card; when a cleaner cancels late the client is still refunded in full and
          the fee is recorded against the cleaner instead. Cancelling for illness or a strike / transport
          failure waives the fee entirely, at any notice. Fees are a reasonable estimate of the other
          party&apos;s lost-slot loss, not a penalty — see Terms of Service Section 9. Changes apply to
          the very next cancellation.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Free window (hours)</label>
            <input type="number" min={1} max={168} value={t1} onChange={e => set("cancel_tier1_hours", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Half-fee window (hours)</label>
            <input type="number" min={1} max={168} value={t2} onChange={e => set("cancel_tier2_hours", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Travel-comp window (hours)</label>
            <input type="number" min={0} max={168} value={t3} onChange={e => set("cancel_tier3_hours", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
          </div>
        </div>

        {/* Reads back the ladder in plain words from whatever is currently typed above. */}
        <div className="bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs text-[#2B3441] space-y-1 mb-4">
          <p>More than <strong>{t1}h</strong> before the job → <strong>free</strong></p>
          <p>Between <strong>{t2}h</strong> and <strong>{t1}h</strong> → <strong>{low}%</strong> of the price</p>
          <p>Between <strong>{t3}h</strong> and <strong>{t2}h</strong> → <strong>{med}%</strong> of the price</p>
          <p>Less than <strong>{t3}h</strong> → <strong>{late}%</strong> plus {euros(cfg.cancel_travel_comp_cents, 500)} travel compensation to the cleaner</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Fee inside the free window %</label>
            <input type="number" min={0} max={100} value={low} onChange={e => set("cancel_fee_low_pct", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Fee inside 24h %</label>
            <input type="number" min={0} max={100} value={med} onChange={e => set("cancel_fee_medium_pct", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Fee in the last hours %</label>
            <input type="number" min={0} max={100} value={late} onChange={e => set("cancel_fee_late_pct", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Travel compensation (€ cents)</label>
            <input type="number" min={0} max={50000} value={cfg.cancel_travel_comp_cents ?? "500"}
              onChange={e => set("cancel_travel_comp_cents", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">
              Paid straight to the cleaner on a very late client cancellation. = {euros(cfg.cancel_travel_comp_cents, 500)}.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">No-show grace period (minutes)</label>
            <input type="number" min={0} max={120} value={cfg.cancel_noshow_grace_minutes ?? "15"}
              onChange={e => set("cancel_noshow_grace_minutes", e.target.value)} onWheel={blurOnWheel} className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">Wait time after the scheduled start before either party can report a no-show.</p>
          </div>
        </div>
      </div>
    </>
  )
}
