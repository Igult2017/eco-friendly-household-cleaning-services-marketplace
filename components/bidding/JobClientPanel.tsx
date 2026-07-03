"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { User, ShieldCheck, ShieldAlert, Briefcase, CheckCircle2, CalendarDays, Star } from "lucide-react"

interface ClientInfo {
  name: string
  memberSince: string | null
  jobsPosted: number
  hires: number
  completedBookings: number
  paymentOnFile: boolean
  clientRating: number | null
  clientReviewCount: number
  recentReviews: { rating: number; body: string }[]
}

// "About the client" — Upwork-style trust panel on the job detail page. Self-fetching so the
// page stays lean; renders nothing until (and unless) the data arrives.
export function JobClientPanel({ jobId }: { jobId: string }) {
  const t = useTranslations("providerProviderJobsPage")
  const [info, setInfo] = useState<ClientInfo | null>(null)

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/client`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.jobsPosted === "number") setInfo(d) })
      .catch(() => {})
  }, [jobId])

  if (!info) return null

  const memberYear = info.memberSince ? new Date(info.memberSince).getFullYear() : null

  return (
    <div className="rounded-xl border border-[#E5EBF0] bg-[#FAFCFB] p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">{t("aboutClient")}</p>

      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D1F0E0]">
          <User size={14} className="text-[#2D7A5F]" />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2B3441]">
            {info.name}
            {info.clientRating != null && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-[#2B3441]">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {info.clientRating.toFixed(1)}
                <span className="font-normal text-[#9CA3AF]">{t("reviewsFromCleaners", { count: info.clientReviewCount })}</span>
              </span>
            )}
          </p>
          {memberYear && (
            <p className="flex items-center gap-1 text-[11px] text-[#6B7280]"><CalendarDays size={11} />{t("memberSince", { year: memberYear })}</p>
          )}
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            info.paymentOnFile ? "bg-[#D1F0E0] text-[#2D7A5F]" : "bg-amber-50 text-amber-700"
          }`}
        >
          {info.paymentOnFile ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {info.paymentOnFile ? t("paymentVerified") : t("paymentUnverified")}
        </span>
      </div>

      {info.recentReviews.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {info.recentReviews.map((r, i) => (
            <p key={i} className="rounded-lg bg-white border border-[#E5EBF0] px-3 py-2 text-xs italic text-[#6B7280]">
              <span className="not-italic font-semibold text-[#2B3441]">{"★".repeat(r.rating)}</span> “{r.body}”
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white border border-[#E5EBF0] px-2 py-2">
          <p className="flex items-center justify-center gap-1 text-sm font-bold text-[#2B3441]"><Briefcase size={12} className="text-[#2D7A5F]" />{info.jobsPosted}</p>
          <p className="text-[10px] text-[#6B7280]">{t("statJobsPosted")}</p>
        </div>
        <div className="rounded-lg bg-white border border-[#E5EBF0] px-2 py-2">
          <p className="flex items-center justify-center gap-1 text-sm font-bold text-[#2B3441]"><User size={12} className="text-[#2D7A5F]" />{info.hires}</p>
          <p className="text-[10px] text-[#6B7280]">{t("statHires")}</p>
        </div>
        <div className="rounded-lg bg-white border border-[#E5EBF0] px-2 py-2">
          <p className="flex items-center justify-center gap-1 text-sm font-bold text-[#2B3441]"><CheckCircle2 size={12} className="text-[#2D7A5F]" />{info.completedBookings}</p>
          <p className="text-[10px] text-[#6B7280]">{t("statCompleted")}</p>
        </div>
      </div>
    </div>
  )
}
