"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { localTodayYmd } from "@/lib/utils/formatDate"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"

// Pulls the first useful message out of either a plain string error or the
// { fieldErrors: { key: [msg] } } shape other job routes return, instead of always
// falling back to a generic message when the server sends back something specific.
function extractError(payload: unknown, fallback: string): string {
  if (typeof payload === "string") return payload
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>
    if (p.fieldErrors && typeof p.fieldErrors === "object") {
      const first = Object.values(p.fieldErrors as Record<string, string[]>).flat()[0]
      if (first) return first
    }
  }
  return fallback
}

interface Initial {
  title: string
  description: string
  hourlyRate: string // whole units, derived from budget ÷ hours
  estimatedHours: string
  desiredDate: string
  timeStart: string
  timeEnd: string
  recurringFrequency: string
}

// Edit a posted job. Full edit until bids arrive; with bids only the desired date is changeable.
export function EditJobForm({ jobId, initial, hasBids, country }: { jobId: string; initial: Initial; hasBids: boolean; country: string }) {
  const t = useTranslations("customerJobEditPage")
  const tp = useTranslations("customerPostjobPage")
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [minHourlyRateCents, setMinHourlyRateCents] = useState(1500)

  useEffect(() => {
    fetch("/api/settings/min-hourly-rate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.cents === "number") setMinHourlyRateCents(d.cents) })
      .catch(() => {})
  }, [])

  const set = (k: keyof Initial, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const lock = hasBids // everything except the date

  async function save() {
    setSaving(true)
    setError("")
    if (!lock && form.hourlyRate && Math.round(parseFloat(form.hourlyRate) * 100) < minHourlyRateCents) {
      setError(tp("errorRateBelowMinimum", { min: formatCurrencyForCountry(minHourlyRateCents, country) }))
      setSaving(false)
      return
    }
    try {
      const body: Record<string, unknown> = { desiredDate: form.desiredDate || undefined }
      if (!lock) {
        body.title = form.title
        body.description = form.description
        if (form.hourlyRate) body.hourlyRate = parseFloat(form.hourlyRate)
        if (form.estimatedHours) body.estimatedHours = parseFloat(form.estimatedHours)
        body.recurringFrequency = form.recurringFrequency || null
        body.desiredTimeRange = form.timeStart && form.timeEnd ? { start: form.timeStart, end: form.timeEnd } : null
      }
      const r = await fetch(`/api/jobs/${jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(extractError(d.error, t("errorGeneric"))); return }
      router.push("/jobs")
      router.refresh()
    } catch { setError(t("errorGeneric")) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      {lock && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("onlyDateNote")}</p>}

      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-4">
        <div>
          <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("jobTitleLabel")}</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} disabled={lock} minLength={5} />
        </div>
        <div>
          <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("descriptionLabel")}</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} disabled={lock} rows={4} className="resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("hourlyRateLabel")}</Label>
            <Input type="number" min={minHourlyRateCents / 100} step="0.5" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} disabled={lock} />
            {!lock && <p className="text-xs text-[#9CA3AF] mt-1">{tp("hourlyRateMinimumHint", { min: formatCurrencyForCountry(minHourlyRateCents, country) })}</p>}
          </div>
          <div>
            <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("estimatedHoursLabel")}</Label>
            <Input type="number" min={0.5} max={12} step={0.5} value={form.estimatedHours} onChange={(e) => set("estimatedHours", e.target.value)} disabled={lock} />
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("desiredDateLabel")}</Label>
          <Input type="date" value={form.desiredDate} onChange={(e) => set("desiredDate", e.target.value)} min={localTodayYmd()} />
          <p className="text-xs text-[#9CA3AF] mt-1">{t("dateHint")}</p>
        </div>
        <div>
          <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("timeWindowLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input type="time" value={form.timeStart} onChange={(e) => set("timeStart", e.target.value)} disabled={lock} className="flex-1" />
            <span className="text-[#9CA3AF]">–</span>
            <Input type="time" value={form.timeEnd} onChange={(e) => set("timeEnd", e.target.value)} disabled={lock} className="flex-1" />
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{tp("recurringLabel")}</Label>
          <select value={form.recurringFrequency} onChange={(e) => set("recurringFrequency", e.target.value)} disabled={lock}
            className="flex h-10 w-full rounded-md border border-[#E5EBF0] bg-white px-3 py-2 text-sm disabled:opacity-50 focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]">
            <option value="">{tp("recurring_none")}</option>
            <option value="recurring">{tp("recurring_recurring")}</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">
          {saving ? <Loader2 size={15} className="animate-spin" /> : t("save")}
        </Button>
        <Button variant="outline" onClick={() => router.push("/jobs")} disabled={saving} className="border-[#E5EBF0]">{t("cancel")}</Button>
      </div>
    </div>
  )
}
