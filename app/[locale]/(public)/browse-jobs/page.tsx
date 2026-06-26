"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { MapPin, Calendar, Leaf, Users, Clock } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"

type Job = {
  id: string
  title: string
  description: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  desiredDate: string | null
  city: string | null
  country: string
  ecoRequirements: string[]
  bidCount: number
  categoryName: string | null
  categorySlug: string | null
  expiresAt: string
  createdAt: string
}

type TFn = (key: string, values?: Record<string, string | number>) => string

function timeAgo(dateStr: string, t: TFn) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return t("justNow")
  if (h < 24) return t("hoursAgo", { count: h })
  return t("daysAgo", { count: Math.floor(h / 24) })
}

function expiresIn(dateStr: string, t: TFn) {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return t("expired")
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return t("hoursLeft", { count: h })
  return t("daysLeft", { count: Math.floor(h / 24) })
}

function StatusBadge({ status, t }: { status: string; t: TFn }) {
  if (status === "assigned") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-0.5">
        {t("notAvailable")}
      </span>
    )
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-xs font-bold px-2.5 py-0.5">
        {t("expired")}
      </span>
    )
  }
  return null
}

export default function BrowseJobsPage() {
  const t = useTranslations("browseJobs")
  const { isSignedIn } = useUser()
  // Signed-in users go straight to the provider bid area (the provider layout routes by role);
  // only signed-out users are sent through sign-in. Routing a signed-in user through /sign-in
  // bounced them to the homepage, so the bid button appeared "broken".
  const bidHref = isSignedIn === false ? "/sign-in?redirect_url=/provider/jobs" : "/provider/jobs"
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/jobs/public")
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#2B3441] to-[#1e2730] py-14 px-4 text-center">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-3">
          {t("heroTitle")}
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
          {t("heroSubtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white font-semibold px-6 py-3 transition-colors"
          >
            {t("becomeProvider")}
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 font-medium px-6 py-3 transition-colors"
          >
            {t("signInToBid")}
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Stats bar */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm font-semibold text-[#2B3441]">{t("openJobsCount", { count: jobs.filter(j => j.status === "open" || j.status === "bidding").length })}</span>
          <span className="text-[#9CA3AF]">·</span>
          <span className="text-sm text-[#6B7280]">{t("updatedEveryMinute")}</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white shadow-sm h-36 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm py-20 text-center">
            <p className="text-[#6B7280]">{t("emptyState")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const isUnavailable = job.status === "assigned" || job.status === "expired"
              return (
              <div key={job.id} className={`rounded-2xl bg-white shadow-sm border p-6 transition-colors ${isUnavailable ? "border-[#E5EBF0] opacity-70" : "border-[#E5EBF0] hover:border-[#2D7A5F]/40"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {job.categoryName && (
                        <span className="rounded-full bg-[#F4FAF6] text-[#2D7A5F] text-xs font-semibold px-2.5 py-0.5 border border-[#2D7A5F]/20">
                          {job.categoryName}
                        </span>
                      )}
                      {job.ecoRequirements && job.ecoRequirements.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5">
                          <Leaf size={10} /> {t("ecoRequired")}
                        </span>
                      )}
                      <StatusBadge status={job.status} t={t} />
                      <span className="text-xs text-[#9CA3AF] ml-auto">{timeAgo(job.createdAt, t)}</span>
                    </div>
                    <h2 className="font-semibold text-[#2B3441] text-lg leading-snug">{job.title}</h2>
                    <p className="text-sm text-[#6B7280] mt-1 line-clamp-2 leading-relaxed">{job.description}</p>
                  </div>

                  {/* Budget */}
                  {(job.budgetMin || job.budgetMax) && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[#9CA3AF] mb-0.5">{t("budget")}</p>
                      <p className="font-bold text-[#2D7A5F] text-lg">
                        {job.budgetMin && job.budgetMax
                          ? `${formatCurrency(job.budgetMin)} – ${formatCurrency(job.budgetMax)}`
                          : job.budgetMax
                          ? t("budgetUpTo", { amount: formatCurrency(job.budgetMax) })
                          : formatCurrency(job.budgetMin!)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#6B7280]">
                  {job.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-[#2D7A5F]" />
                      {job.city}, {job.country}
                    </span>
                  )}
                  {job.desiredDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#2D7A5F]" />
                      {new Date(job.desiredDate).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users size={12} className="text-[#2D7A5F]" />
                    {t("bidCount", { count: job.bidCount })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} className={job.expiresAt && new Date(job.expiresAt).getTime() - Date.now() < 3_600_000 * 6 ? "text-red-500" : "text-[#2D7A5F]"} />
                    {expiresIn(job.expiresAt, t)}
                  </span>
                </div>

                {/* CTA */}
                <div className="mt-4 pt-4 border-t border-[#E5EBF0] flex items-center justify-between gap-3">
                  {isUnavailable ? (
                    <p className="text-xs text-[#9CA3AF]">
                      {job.status === "assigned" ? t("providerSelected") : t("jobExpired")}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-[#9CA3AF]">{t("signInAsProvider")}</p>
                      <Link
                        href={bidHref}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold px-4 py-2 transition-colors"
                      >
                        {t("bidOnThisJob")}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl bg-[#2B3441] p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-white mb-2">{t("bottomCtaTitle")}</h2>
          <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">
            {t("bottomCtaSubtitle")}
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white font-semibold px-8 py-3 transition-colors"
          >
            {t("createProviderAccount")}
          </Link>
        </div>
      </div>
    </div>
  )
}
