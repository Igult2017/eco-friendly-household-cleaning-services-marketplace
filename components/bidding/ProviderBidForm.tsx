"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { localTodayYmd } from "@/lib/utils/formatDate"

// Bid form used on the job DETAIL page (the feed keeps its inline copy). Posts to the same
// authoritative bids API — all gating (own/IP/radius) is enforced server-side regardless.
export function ProviderBidForm({ jobId, onSubmitted }: { jobId: string; onSubmitted: () => void }) {
  const t = useTranslations("providerProviderJobsPage")
  const [form, setForm] = useState({ amount: "", message: "", estimatedDurationMinutes: "120", proposedDate: "" })
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function extractError(payload: unknown): string {
    if (typeof payload === "string") return payload
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>
      const all = [
        ...(Array.isArray(p.formErrors) ? (p.formErrors as string[]) : []),
        ...(p.fieldErrors && typeof p.fieldErrors === "object" ? Object.values(p.fieldErrors as Record<string, string[]>).flat() : []),
      ].filter(Boolean)
      if (all.length) return all.join(" · ")
    }
    return t("genericError")
  }

  async function submit() {
    // Every box here is optional — a blank price isn't an error, the server fills it in from the
    // cleaner's own listed rate for this job's category (see app/api/jobs/[id]/bids/route.ts).
    const amountUnits = form.amount ? parseFloat(form.amount) : NaN
    if (form.amount && (isNaN(amountUnits) || amountUnits < 1)) {
      setError(t("invalidBidAmount"))
      return
    }
    if (!acceptedPolicy) {
      setError(t("mustAcceptCancellationPolicy"))
      return
    }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: form.amount ? Math.round(amountUnits * 100) : undefined,
          message: form.message || undefined,
          estimatedDurationMinutes: Number.isFinite(parseInt(form.estimatedDurationMinutes)) ? parseInt(form.estimatedDurationMinutes) : undefined,
          proposedDate: form.proposedDate || undefined,
          acceptedCancellationPolicy: acceptedPolicy,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(extractError(d.error))
        return
      }
      onSubmitted()
    } catch {
      setError(t("networkError"))
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-[#2B3441]">{t("yourBid")}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("yourPriceLabel")}</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder={t("yourPriceAutoPlaceholder")} min={1} className="bg-white" />
          <p className="text-[11px] text-[#9CA3AF] mt-1">{t("yourPriceAutoHint")}</p>
        </div>
        <div>
          <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("durationLabel")}</Label>
          <Input type="number" value={form.estimatedDurationMinutes} onChange={(e) => setForm((p) => ({ ...p, estimatedDurationMinutes: e.target.value }))} className="bg-white" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("proposedDateLabel")}</Label>
        <Input type="date" value={form.proposedDate} onChange={(e) => setForm((p) => ({ ...p, proposedDate: e.target.value }))} className="bg-white" min={localTodayYmd()} />
      </div>
      <div>
        <Label className="text-xs font-medium text-[#2B3441] mb-1 block">{t("messageLabel")}</Label>
        <Textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder={t("messagePlaceholder")} rows={3} className="resize-none bg-white text-sm" />
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={acceptedPolicy} onChange={(e) => setAcceptedPolicy(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#2D7A5F] rounded shrink-0" />
        <span className="text-xs text-[#6B7280] leading-snug">
          {t.rich("acceptCancellationPolicyBid", { link: (chunks) => <a href="/legal/terms#cancellation-policy" target="_blank" className="text-[#2D7A5F] underline">{chunks}</a> })}
        </span>
      </label>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <Button onClick={submit} disabled={submitting || !acceptedPolicy} className="w-full h-10 bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold">
        {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> {t("submitting")}</> : t("submitBid")}
      </Button>
    </div>
  )
}
