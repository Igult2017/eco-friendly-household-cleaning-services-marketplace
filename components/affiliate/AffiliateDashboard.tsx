"use client"

import { useEffect, useState } from "react"
import { Link2, Users, CheckCircle2, Clock, Euro, Copy, Check, TrendingUp } from "lucide-react"
import { ReferralLinkBuilder } from "./ReferralLinkBuilder"

type Data = {
  code: string | null
  referralUrl: string | null
  stats: { total: number; active: number; pending: number; totalEarnedCents: number }
  credit: { balanceCents: number; lifetimeEarnedCents: number }
}

function eur(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format((cents ?? 0) / 100)
}

export function AffiliateDashboard() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function copy() {
    if (!data?.referralUrl) return
    try {
      await navigator.clipboard.writeText(data.referralUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (loading) return <p className="text-sm text-[#6B7280]">Loading your dashboard…</p>

  const stats = data?.stats
  const cards = [
    { label: "Referred", value: stats?.total ?? 0, icon: Users },
    { label: "Active", value: stats?.active ?? 0, icon: CheckCircle2 },
    { label: "Pending", value: stats?.pending ?? 0, icon: Clock },
    { label: "Lifetime earned", value: eur(data?.credit.lifetimeEarnedCents ?? 0), icon: TrendingUp },
  ]
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="space-y-8">
      {/* Referral link */}
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-4 w-4 text-[#2D7A5F]" />
          <h2 className="font-semibold text-[#2B3441]">Your referral link</h2>
        </div>
        <p className="text-sm text-[#6B7280] mb-4">
          Share this link. When someone you bring in books a cleaning, you earn a commission — for life.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 font-mono text-sm bg-[#F4FAF6] border border-[#E5EBF0] rounded-lg px-4 py-3 text-[#2B3441] truncate">
            {data?.referralUrl ?? "—"}
          </div>
          <button
            onClick={copy}
            disabled={!data?.referralUrl}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2D7A5F] text-white px-5 py-3 text-sm font-semibold hover:bg-[#235f49] transition-colors disabled:opacity-50"
          >
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
          </button>
        </div>
      </div>

      {/* Promote any page */}
      {data?.code && <ReferralLinkBuilder code={data.code} origin={origin} />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F0] mb-3">
              <Icon className="h-4 w-4 text-[#2D7A5F]" />
            </div>
            <p className="text-2xl font-bold text-[#2B3441] font-serif leading-none">{value}</p>
            <p className="text-sm text-[#6B7280] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Balance / payout */}
      <div className="rounded-2xl bg-[#2B3441] text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-white/60">Available balance</p>
          <p className="text-3xl font-bold font-serif">{eur(data?.credit.balanceCents ?? 0)}</p>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/70">
          <Euro className="h-3.5 w-3.5 text-[#4CB87A]" /> Automatic payouts coming soon
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-6">
        <h2 className="font-semibold text-[#2B3441] mb-4">How you earn</h2>
        <ol className="space-y-3 text-sm text-[#6B7280]">
          <li><span className="font-semibold text-[#2D7A5F]">1.</span> Share your link on social, your blog, anywhere.</li>
          <li><span className="font-semibold text-[#2D7A5F]">2.</span> Someone signs up through it — they're linked to you.</li>
          <li><span className="font-semibold text-[#2D7A5F]">3.</span> Every time they book a cleaning, you earn a commission — for life.</li>
        </ol>
      </div>
    </div>
  )
}
