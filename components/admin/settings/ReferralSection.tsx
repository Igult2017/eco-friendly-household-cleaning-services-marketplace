"use client"

import { Config, SetFn, blurOnWheel, INPUT_CLS, euros, ordinal } from "./shared"

// The referral programme (one flat reward, paid once), the recurring-booking discount, and the
// separate affiliate programme — which is the ONE referrer type still paid a percentage of every
// booking, because that is what the public /affiliate page advertises.
export function ReferralSection({ cfg, set }: { cfg: Config; set: SetFn }) {
  const reward = euros(cfg.referral_reward_cents, 2500)
  const cleanerJobs = parseInt(cfg.referral_cleaner_jobs_required ?? "2") || 1
  const clientJobs = parseInt(cfg.referral_client_jobs_required ?? "1") || 1
  const affiliatePct = parseInt(cfg.client_referral_discount_pct ?? "5") || 0

  return (
    <>
      {/* Referral programme */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Referral &amp; Discount Programme</label>
        <p className="text-xs text-[#6B7280] mb-4">
          One flat reward, paid <strong>once</strong> per person invited, as soon as that person has
          completed the number of jobs set below. Cleaners receive it as cash (paid out monthly);
          everyone else receives it as a balance they can spend at checkout or withdraw. It is not a
          share of the booking and it does not repeat on later bookings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Reward (€ cents)</label>
            <input type="number" min={0} max={100000} value={cfg.referral_reward_cents ?? "2500"}
              onChange={e => set("referral_reward_cents", e.target.value)} onWheel={blurOnWheel}
              className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">= {reward} per referral</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Cleaner: jobs needed</label>
            <input type="number" min={1} max={20} value={cfg.referral_cleaner_jobs_required ?? "2"}
              onChange={e => set("referral_cleaner_jobs_required", e.target.value)} onWheel={blurOnWheel}
              className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">Before an invited cleaner earns it</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Client: bookings needed</label>
            <input type="number" min={1} max={20} value={cfg.referral_client_jobs_required ?? "1"}
              onChange={e => set("referral_client_jobs_required", e.target.value)} onWheel={blurOnWheel}
              className={`w-full ${INPUT_CLS}`} />
            <p className="text-xs text-[#6B7280] mt-1">Before an invited client earns it</p>
          </div>
        </div>

        <div className="bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs text-[#2B3441] space-y-1 mb-4">
          <p>Invite a cleaner → <span className="font-semibold text-[#2D7A5F]">{reward}</span> after their {cleanerJobs === 1 ? "first completed job" : `${ordinal(cleanerJobs)} completed job`}</p>
          <p>Invite a client → <span className="font-semibold text-[#2D7A5F]">{reward}</span> after their {clientJobs === 1 ? "first completed booking" : `${ordinal(clientJobs)} completed booking`}</p>
          <p className="text-[#6B7280]">Nothing further is paid on their later bookings.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1">Recurring booking discount %</label>
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={50} value={cfg.recurring_discount_pct ?? "10"}
              onChange={e => set("recurring_discount_pct", e.target.value)} onWheel={blurOnWheel}
              className={`w-24 ${INPUT_CLS}`} />
            <span className="text-sm text-[#6B7280]">
              % off the client&apos;s 2nd and 3rd cleaning on a recurring schedule, all cleaners
            </span>
          </div>
        </div>
      </div>

      {/* Affiliate programme — the one percentage left */}
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Affiliate Programme</label>
        <p className="text-xs text-[#6B7280] mb-3">
          Separate from the referral reward above, and still a <strong>percentage of every booking,
          ongoing</strong> — a signed-up Affiliate/Partner earns this share for the life of everyone
          they introduce. That is exactly what the public{" "}
          <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">/affiliate</code> page
          advertises, and it reads this same live number, so the two can never drift apart.
        </p>
        <div className="flex items-center gap-3">
          <input type="number" min={0} max={20} value={cfg.client_referral_discount_pct ?? "5"}
            onChange={e => set("client_referral_discount_pct", e.target.value)} onWheel={blurOnWheel}
            className={`w-24 ${INPUT_CLS}`} />
          <span className="text-sm text-[#6B7280]">% of every booking subtotal an affiliate refers, for life</span>
        </div>
        <div className="mt-3 bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs text-[#2B3441] space-y-1">
          <p>Referred booking subtotal <span className="font-semibold">€100</span></p>
          <p>Affiliate earns <span className="font-semibold text-[#2D7A5F]">€{affiliatePct}</span> ({affiliatePct}%) — on that booking and every one after it</p>
        </div>
      </div>
    </>
  )
}
