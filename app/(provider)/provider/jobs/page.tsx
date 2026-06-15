"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { Loader2, MapPin, Clock, Euro, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface JobPost {
  id: string
  title: string
  description: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  desiredDate: string | null
  serviceAddress: { line1: string; city: string; postalCode: string }
  ecoRequirements: string[]
  expiresAt: string
  createdAt: string
  category: { name: string } | null
  bids: { id: string; providerId: string; status: string }[]
}

export default function ProviderJobsPage() {
  const t = useTranslations("providerProviderJobsPage")
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [loading, setLoading] = useState(true)
  const [bidding, setBidding] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [bidForm, setBidForm] = useState({ amount: "", message: "", estimatedDurationMinutes: "120", proposedDate: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/jobs?forProvider=true")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
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
          estimatedDurationMinutes: parseInt(bidForm.estimatedDurationMinutes),
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

        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E5EBF0]">
            <Clock size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">{t("emptyTitle")}</h2>
            <p className="text-[#6B7280]">{t("emptyDescription")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const alreadyBid = submitted.has(job.id)
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
                          <p className="font-bold text-[#2D7A5F] text-sm">{formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}</p>
                        )}
                        <p className="text-xs text-[#9CA3AF] mt-1">{t("bidCount", { count: job.bids.length })}</p>
                      </div>
                    </div>

                    <p className="text-sm text-[#6B7280] mb-3 line-clamp-3">{job.description}</p>

                    <div className="flex flex-wrap gap-3 text-xs text-[#9CA3AF] mb-4">
                      <span className="flex items-center gap-1"><MapPin size={12} />{job.serviceAddress.city}, {job.serviceAddress.postalCode}</span>
                      {job.desiredDate && <span className="flex items-center gap-1"><Clock size={12} />{formatDate(job.desiredDate)}</span>}
                    </div>

                    {job.ecoRequirements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {job.ecoRequirements.map((r) => (
                          <span key={r} className="text-xs bg-[#D1F0E0] text-[#2D7A5F] px-2 py-0.5 rounded-full">🌿 {r}</span>
                        ))}
                      </div>
                    )}

                    {alreadyBid ? (
                      <div className="flex items-center gap-2 text-sm text-[#2D7A5F] font-medium">
                        <CheckCircle2 size={16} /> {t("bidSubmittedSuccess")}
                      </div>
                    ) : (
                      <Button
                        onClick={() => setBidding(isOpen ? null : job.id)}
                        className={cn("h-9 text-sm transition-all", isOpen ? "bg-[#E5EBF0] text-[#2B3441] hover:bg-[#E5EBF0]" : "bg-[#2D7A5F] hover:bg-[#235f49] text-white")}
                      >
                        {isOpen ? t("cancel") : t("submitABid")}
                      </Button>
                    )}
                  </div>

                  {isOpen && !alreadyBid && (
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
                        <Input type="date" value={bidForm.proposedDate} onChange={(e) => setBidForm((p) => ({ ...p, proposedDate: e.target.value }))} className="bg-white" min={new Date().toISOString().split("T")[0]} />
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
