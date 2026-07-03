"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, Check, Users, TrendingUp, Gift, Wallet } from "lucide-react"

interface ReferralStats {
  code: string | null
  referralUrl: string | null
  referralPct?: number
  stats: { total: number; active: number; pending: number; totalEarnedCents: number }
  credit: { balanceCents: number; lifetimeEarnedCents: number }
}

function fmt(cents: number) {
  return `€${(cents / 100).toFixed(2)}`
}

export function ReferralCard() {
  const t = useTranslations("compReferralReferralCard")
  const [data, setData] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.stats && d.credit) setData(d) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const pct = data?.referralPct ?? 5

  async function copyLink() {
    if (!data?.referralUrl) return
    await navigator.clipboard.writeText(data.referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2B3441] to-[#3a4a5a] px-6 py-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#2D7A5F] flex items-center justify-center">
            <Gift size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white leading-tight">{t("title")}</h3>
            <p className="text-xs text-white/60">{t("subtitle", { pct })}</p>
          </div>
        </div>

        {/* Link box */}
        {loading ? (
          <div className="h-10 rounded-xl bg-white/10 animate-pulse" />
        ) : data?.referralUrl ? (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2.5 border border-white/20">
            <span className="flex-1 text-xs text-white/80 font-mono truncate">{data.referralUrl}</span>
            <button
              onClick={copyLink}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2D7A5F] hover:bg-[#256349] rounded-lg px-3 py-1.5 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/50">{t("loadError")}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-gray-100">
        {[
          { icon: Users, label: t("statReferred"), value: loading ? "—" : String(data?.stats?.total ?? 0) },
          { icon: TrendingUp, label: t("statActive"), value: loading ? "—" : String(data?.stats?.active ?? 0) },
          { icon: Gift, label: t("statTotalEarned"), value: loading ? "—" : fmt(data?.stats?.totalEarnedCents ?? 0) },
          { icon: Wallet, label: t("statCreditBalance"), value: loading ? "—" : fmt(data?.credit?.balanceCents ?? 0) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center py-4 px-2 gap-1">
            <Icon size={14} className="text-[#2D7A5F]" />
            <p className="text-sm font-bold text-[#2B3441]">{value}</p>
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wide text-center">{label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="px-6 py-4 border-t border-gray-100 bg-[#FAFAFA]">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-3">{t("howItWorks")}</p>
        <ol className="space-y-2">
          {[
            t("step1"),
            t("step2"),
            t("step3", { pct }),
            t("step4"),
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-[#6B7280]">
              <span className="w-4 h-4 rounded-full bg-[#D1F0E0] text-[#2D7A5F] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
