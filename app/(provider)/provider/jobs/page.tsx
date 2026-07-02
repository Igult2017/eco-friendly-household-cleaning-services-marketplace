"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { formatDate, localTodayYmd } from "@/lib/utils/formatDate"
import { Loader2, MapPin, Clock, Euro, CheckCircle2, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface JobPost {
  id: string
  title: string
  description: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  desiredDate: string | null
  desiredTimeRange: { start: string; end: string } | null
  estimatedDurationMinutes: number | null
  radiusKm: number
  own: boolean
  withinRadius: boolean
  distanceLabel: string | null
  alreadyBid: boolean
  wonByMe: boolean
  serviceAddress: { line1: string; city: string; postalCode: string; country: string | null }
  ecoRequirements: string[]
  recurringFrequency: string | null
  expiresAt: string
  createdAt: string
  category: { name: string } | null
  bids: { id: string; providerId: string; status: string }[]
}

export default function ProviderJobsPage() {
  const t = useTranslations("providerProviderJobsPage")
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [bidding, setBidding] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [bidForm, setBidForm] = useState({ amount: "", message: "", estimatedDurationMinutes: "120", proposedDate: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/jobs?forProvider=true")
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setReason(d.reason ?? null) })
      .finally(() => setLoading(false))
  }, [])

  function extractError(payload: unknown): string {
    if (typeof payload === "string") return payload
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>
      const form = Array.isArray(p.formErrors) ? p.formErrors as string[] : []
      const fields = p.fieldErrors && typeof p.fieldErrors === "object"
        ? Object.values(p.fieldErrors as Record<string, string[]>).flat()
        : []
      const all = [...form, ...fields].filter(Boolean)
      if (all.length) return all.join(" · ")
    }
    return t("genericError")
  }

  async function submitBid(jobId: string) {
    const amountEuros = parseFloat(bidForm.amount)
    if (!bidForm.amount || isNaN(amountEuros) || amountEuros < 1) {
      setError(t("invalidBidAmount"))
      return
    }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amountEuros * 100),
          message: bidForm.message || undefined,
          // A cleared field parses to NaN → JSON null → zod rejects with a cryptic error. Omit instead.
          estimatedDurationMinutes: Number.isFinite(parseInt(bidForm.estimatedDurationMinutes)) ? parseInt(bidForm.estimatedDurationMinutes) : undefined,
          proposedDate: bidForm.proposedDate || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(extractError(d.error))
        return
      }
      setSubmitted((prev) => new Set([...prev, jobId]))
      setBidding(null)
      setBidForm({ amount: "", message: "", estimatedDurationMinutes: "120", proposedDate: "" })
    } catch {
      setError(t("networkError"))
    } finally { setSubmitting(false) }
  }

  // Reason-specific empty state so a cleaner always learns WHY there are no jobs (and what to do),
  // instead of a blank board. "only_own"/"none_posted" stay the friendly default — own jobs are
  // hidden by design and need no prompt.
  function emptyContent() {
    switch (reason) {
      case "no_location": return { title: t("noLocationTitle"), body: t("noLocationBody"), ctaLabel: t("noLocationCta") as string | null, href: "/provider/profile" as string | null }
      case "not_active": return { title: t("notActiveTitle"), body: t("notActiveBody"), ctaLabel: t("notActiveCta") as string | null, href: "/provider/profile" as string | null }
      case "none_nearby": return { title: t("noneNearbyTitle"), body: t("noneNearbyBody"), ctaLabel: t("noneNearbyCta") as string | null, href: "/provider/profile" as string | null }
      case "only_own": return { title: t("onlyOwnTitle"), body: t("onlyOwnBody"), ctaLabel: null as string | null, href: null as string | null }
      default: return { title: t("emptyTitle"), body: t("emptyDescription"), ctaLabel: null as string | null, href: null as string | null }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#2D7A5F]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{t("pageTitle")}</h1>
          <p className="text-[#6B7280] text-sm mt-1">{t("pageSubtitle")}</p>
        </div>

        {jobs.length === 0 ? (() => {
          const e = emptyContent()
          return (
            <div className="text-center py-16 px-6 bg-white rounded-2xl border border-[#E5EBF0]">
              <Clock size={48} className="mx-auto text-[#9CA3AF] mb-4" />
              <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">{e.title}</h2>
              <p className="text-[#6B7280] max-w-md mx-auto">{e.body}</p>
              {e.href && e.ctaLabel && (
                <Link href={e.href} className="inline-flex items-center justify-center mt-6 h-10 px-5 rounded-lg bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-medium transition-all">
                  {e.ctaLabel}
                </Link>
              )}
            </div>
          )
        })() : (
          <div className="space-y-4">
            {jobs.map((job) => {
              // Server flag survives reloads; the local set covers bids submitted this session.
              const alreadyBid = job.alreadyBid || submitted.has(job.id)
              const isOpen = bidding === job.id

              return (
                <div key={job.id} className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h2 className="font-semibold text-[#2B3441]">{job.title}</h2>
                        {job.category && <Badge className="bg-[#D1F0E0] text-[#2D7A5F] text-xs mt-1">{job.category.name}</Badge>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {job.budgetMin && job.budgetMax && (
                          <p className="font-bold text-[#2D7A5F] text-sm">
                            {job.budgetMin === job.budgetMax
                              ? formatCurrencyForCountry(job.budgetMin, job.serviceAddress.country ?? "DE")
                              : <>{formatCurrencyForCountry(job.budgetMin, job.serviceAddress.country ?? "DE")} – {formatCurrencyForCountry(job.budgetMax, job.serviceAddress.country ?? "DE")}</>}
                          </p>
                        )}
                        {/* Implied hourly — per-hour is the payment mode; currency follows the JOB's country. */}
                        {job.budgetMin && job.budgetMax && job.estimatedDurationMinutes ? (
                          <p className="text-[11px] text-[#6B7280]">
                            ≈ {formatCurrencyForCountry(Math.round((job.budgetMin * 60) / job.estimatedDurationMinutes), job.serviceAddress.country ?? "DE")}
                            {job.budgetMin !== job.budgetMax && <> – {formatCurrencyForCountry(Math.round((job.budgetMax * 60) / job.estimatedDurationMinutes), job.serviceAddress.country ?? "DE")}</>}/h
                          </p>
                        ) : null}
                        <p className="text-xs text-[#9CA3AF] mt-1">{t("bidCount", { count: job.bids.length })}</p>
                      </div>
                    </div>

                    <p className="text-sm text-[#6B7280] mb-3 line-clamp-3">{job.description}</p>

                    <div className="flex flex-wrap gap-3 text-xs text-[#9CA3AF] mb-4">
                      <span className="flex items-center gap-1"><MapPin size={12} />{job.serviceAddress.city}, {job.serviceAddress.postalCode}{job.distanceLabel && <> · {job.distanceLabel}</>}</span>
                      {job.desiredDate && <span className="flex items-center gap-1"><Clock size={12} />{formatDate(job.desiredDate)}</span>}
                      {job.desiredTimeRange?.start && job.desiredTimeRange?.end && (
                        <span className="flex items-center gap-1">{job.desiredTimeRange.start}–{job.desiredTimeRange.end}</span>
                      )}
                      {job.estimatedDurationMinutes && (
                        <span className="flex items-center gap-1">{t("estHours", { hours: job.estimatedDurationMinutes % 60 === 0 ? String(job.estimatedDurationMinutes / 60) : (job.estimatedDurationMinutes / 60).toFixed(1) })}</span>
                      )}
                      {job.recurringFrequency && (
                        <span className="flex items-center gap-1 bg-[#D1F0E0] text-[#2D7A5F] font-medium px-2 py-0.5 rounded-full">
                          <Repeat size={12} />{t("recurringLabel")}
                          {["weekly", "biweekly", "monthly"].includes(job.recurringFrequency) && <> · {t(`recurring_${job.recurringFrequency}`)}</>}
                        </span>
                      )}
                    </div>

                    {job.ecoRequirements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {job.ecoRequirements.map((r) => (
                          <span key={r} className="text-xs bg-[#D1F0E0] text-[#2D7A5F] px-2 py-0.5 rounded-full">🌿 {r}</span>
                        ))}
                      </div>
                    )}

                    {job.wonByMe ? (
                      <Link
                        href={`/provider/jobs/${job.id}/messages`}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors"
                      >
                        <CheckCircle2 size={14} /> {t("wonChat")}
                      </Link>
                    ) : alreadyBid ? (
                      <div className="flex items-center gap-2 text-sm text-[#2D7A5F] font-medium">
                        <CheckCircle2 size={16} /> {t("bidSubmittedSuccess")}
                      </div>
                    ) : job.own ? (
                      // Upwork model: your own posting is visible but never biddable.
                      <p className="text-sm text-[#9CA3AF]">{t("ownJobNotice")}</p>
                    ) : (
                      <Button
                        onClick={() => { setError(null); setBidding(isOpen ? null : job.id) }}
                        className={cn("h-9 text-sm transition-all", isOpen ? "bg-[#E5EBF0] text-[#2B3441] hover:bg-[#E5EBF0]" : "bg-[#2D7A5F] hover:bg-[#235f49] text-white")}
                      >
                        {isOpen ? t("cancel") : t("submitABid")}
                      </Button>
                    )}
                  </div>

                  {isOpen && !job.wonByMe && !alreadyBid && !job.own && !job.withinRadius && (
                    // Visible but out of the client's requested radius — explain instead of a form.
                    <div className="border-t border-[#F4FAF6] bg-amber-50 p-5">
                      <p className="text-sm text-amber-800">
                        {t("outOfRadiusNotice", { city: job.serviceAddress.city ?? "—", radius: job.radiusKm })}
                      </p>
                    </div>
                  )}

                  {isOpen && !job.wonByMe && !alreadyBid && !job.own && job.withinRadius && (
                    <div className="border-t border-[#F4FAF6] bg-[#F4FAF6] p-5 space-y-3">
                      <h3 className="font-semibold text-sm text-[#2B3441]">{t("yourBid")}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("yourPriceLabel")}</Label>
                          <Input type="number" value={bidForm.amount} onChange={(e) => setBidForm((p) => ({ ...p, amount: e.target.value }))} placeholder="75" min={1} className="bg-white" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("durationLabel")}</Label>
                          <Input type="number" value={bidForm.estimatedDurationMinutes} onChange={(e) => setBidForm((p) => ({ ...p, estimatedDurationMinutes: e.target.value }))} className="bg-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("proposedDateLabel")}</Label>
                        <Input type="date" value={bidForm.proposedDate} onChange={(e) => setBidForm((p) => ({ ...p, proposedDate: e.target.value }))} className="bg-white" min={localTodayYmd()} />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("messageLabel")}</Label>
                        <Textarea value={bidForm.message} onChange={(e) => setBidForm((p) => ({ ...p, message: e.target.value }))} placeholder={t("messagePlaceholder")} rows={3} className="resize-none bg-white text-sm" />
                      </div>
                      {error && <p className="text-red-500 text-xs">{error}</p>}
                      <Button onClick={() => submitBid(job.id)} disabled={submitting} className="w-full h-9 bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm">
                        {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> {t("submitting")}</> : t("submitBid")}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
