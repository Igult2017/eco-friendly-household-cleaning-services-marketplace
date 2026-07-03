"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { formatDate, localTodayYmd } from "@/lib/utils/formatDate"
import { Loader2, MapPin, Clock, CheckCircle2, Repeat, Users } from "lucide-react"
import { ProviderBidForm } from "@/components/bidding/ProviderBidForm"

interface JobPost {
  id: string; title: string; description: string; status: string
  budgetMin: number | null; budgetMax: number | null
  desiredDate: string | null; desiredTimeRange: { start: string; end: string } | null
  estimatedDurationMinutes: number | null; radiusKm: number
  own: boolean; withinRadius: boolean; distanceLabel: string | null
  alreadyBid: boolean; wonByMe: boolean
  serviceAddress: { line1: string; city: string; postalCode: string; country: string | null }
  ecoRequirements: string[]; recurringFrequency: string | null
  createdAt: string
  category: { name: string } | null
  bids: { id: string; providerId: string; status: string }[]
}

// Upwork-style full job view: the feed card links here so a cleaner reads EVERYTHING —
// full description, schedule, rate, competition — before bidding.
export default function ProviderJobDetailPage() {
  const t = useTranslations("providerProviderJobsPage")
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<JobPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // Same feed endpoint = identical visibility/gating flags; the detail is one of its items.
    fetch("/api/jobs?forProvider=true")
      .then((r) => r.json())
      .then((d) => setJob(((d.jobs ?? []) as JobPost[]).find((j) => j.id === id) ?? null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-[#F4FAF6] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#2D7A5F]" /></div>
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] py-16 px-4 text-center">
        <p className="text-[#6B7280] mb-6">{t("jobNotFound")}</p>
        <Link href="/provider/jobs" className="text-[#2D7A5F] font-semibold hover:underline">{t("backToJobs")}</Link>
      </div>
    )
  }

  const country = job.serviceAddress.country ?? "DE"
  const mins = job.estimatedDurationMinutes
  const hourly = job.budgetMin && mins ? Math.round((job.budgetMin * 60) / mins) : null
  const alreadyBid = job.alreadyBid || submitted
  const hoursLabel = mins ? (mins % 60 === 0 ? String(mins / 60) : (mins / 60).toFixed(1)) : null

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/provider/jobs" className="inline-block text-sm text-[#6B7280] hover:text-[#2D7A5F] mb-4">{t("backToJobs")}</Link>

        <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold text-[#2B3441] leading-snug">{job.title}</h1>
              {job.category && <span className="inline-block mt-1 rounded-full bg-[#D1F0E0] px-2.5 py-0.5 text-xs font-semibold text-[#2D7A5F]">{job.category.name}</span>}
            </div>
            <div className="text-right shrink-0">
              {hourly ? (
                <>
                  <p className="font-bold text-[#2D7A5F] text-2xl">{t("perHour", { amount: formatCurrencyForCountry(hourly, country) })}</p>
                  {job.budgetMin ? <p className="text-xs text-[#6B7280]">{t("totalApprox", { amount: formatCurrencyForCountry(job.budgetMin, country) })}</p> : null}
                </>
              ) : job.budgetMin ? (
                <p className="font-bold text-[#2D7A5F] text-2xl">{formatCurrencyForCountry(job.budgetMin, country)}</p>
              ) : null}
              <p className="text-xs text-[#9CA3AF] mt-1 flex items-center justify-end gap-1"><Users size={12} />{t("bidCount", { count: job.bids.length })}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-[#6B7280] mb-5">
            <span className="flex items-center gap-1"><MapPin size={12} />{job.serviceAddress.city}, {job.serviceAddress.postalCode}{job.distanceLabel && <> · {job.distanceLabel}</>}</span>
            {job.desiredDate && <span className="flex items-center gap-1"><Clock size={12} />{formatDate(job.desiredDate)}</span>}
            {job.desiredDate && job.desiredDate < localTodayYmd() && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                {t("overdueChip", { days: Math.max(1, Math.floor((Date.now() - new Date(job.desiredDate + "T12:00:00").getTime()) / 86_400_000)) })}
              </span>
            )}
            {job.desiredTimeRange?.start && job.desiredTimeRange?.end && <span>{job.desiredTimeRange.start}–{job.desiredTimeRange.end}</span>}
            {hoursLabel && <span>{t("estHours", { hours: hoursLabel })}</span>}
            {job.recurringFrequency && (
              <span className="flex items-center gap-1 rounded-full bg-[#D1F0E0] px-2 py-0.5 font-medium text-[#2D7A5F]">
                <Repeat size={12} />{t("recurringLabel")}
                {["weekly", "biweekly", "monthly"].includes(job.recurringFrequency) && <> · {t(`recurring_${job.recurringFrequency}`)}</>}
              </span>
            )}
          </div>

          {/* FULL description — the whole point of the detail view (the feed clamps it to 3 lines). */}
          <p className="text-sm text-[#2B3441] leading-relaxed whitespace-pre-wrap mb-5">{job.description}</p>

          {job.ecoRequirements.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {job.ecoRequirements.map((r) => (
                <span key={r} className="text-xs bg-[#D1F0E0] text-[#2D7A5F] px-2 py-0.5 rounded-full">🌿 {r}</span>
              ))}
            </div>
          )}

          <div className="border-t border-[#F4FAF6] pt-5">
            {job.wonByMe ? (
              <Link href={`/provider/jobs/${job.id}/messages`} className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors">
                <CheckCircle2 size={14} /> {t("wonChat")}
              </Link>
            ) : alreadyBid ? (
              <div className="flex items-center gap-2 text-sm font-medium text-[#2D7A5F]"><CheckCircle2 size={16} /> {t("bidSubmittedSuccess")}</div>
            ) : job.own ? (
              <p className="text-sm text-[#9CA3AF]">{t("ownJobNotice")}</p>
            ) : !job.withinRadius ? (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                {t("outOfRadiusNotice", { city: job.serviceAddress.city ?? "—", radius: job.radiusKm })}
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs font-medium text-[#6B7280]">
                  {job.bids.length === 0 ? t("firstBidNote") : t("competitionNote", { count: job.bids.length })}
                </p>
                <ProviderBidForm jobId={job.id} onSubmitted={() => setSubmitted(true)} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
