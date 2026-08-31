"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

// Propose a new date/time (and, cleaner-only, a new hourly rate) for an existing booking. Nothing
// changes until the OTHER party accepts (see proposal-response route) — this just writes the
// request. Shared by both roles: a client can only ever propose a date/time change, a cleaner can
// also counter-offer the rate (allowRateChange), matching who's allowed to set the price.
export function ProposeChangeForm({ bookingId, onDone, onCancel, allowRateChange }: {
  bookingId: string
  onDone: () => void
  onCancel?: () => void
  allowRateChange: boolean
}) {
  const t = useTranslations("compBookingRespondActions")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [hourly, setHourly] = useState("")
  const [message, setMessage] = useState("")
  // Admin-configurable wage floor (lib/platform/settings.ts getMinHourlyRateCents) — 1500 (€15) is
  // just the initial guess shown before the live value loads; the server is the real source of truth.
  const [minHourlyRateCents, setMinHourlyRateCents] = useState(1500)

  useEffect(() => {
    if (!allowRateChange) return
    fetch("/api/settings/min-hourly-rate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.cents === "number") setMinHourlyRateCents(d.cents) })
      .catch(() => {})
  }, [allowRateChange])

  async function submit() {
    const hourlyCents = allowRateChange && hourly ? Math.round(parseFloat(hourly) * 100) : undefined
    const scheduledAt = date && time ? new Date(`${date}T${time}:00`).toISOString() : undefined
    if (!hourlyCents && !scheduledAt) { setError(t("suggestNothing")); return }
    // A reason is required specifically when a date/time change is being proposed.
    if (scheduledAt && message.trim().length < 5) { setError(t("reasonRequiredForChange")); return }
    if (hourlyCents && hourlyCents < minHourlyRateCents) {
      setError(t("rateBelowMinimum", { min: (minHourlyRateCents / 100).toFixed(2) }))
      return
    }
    setBusy(true)
    setError("")
    try {
      const r = await fetch(`/api/bookings/${bookingId}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, hourlyCents, message: message.trim() || undefined }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(typeof d.error === "string" ? d.error : t("genericError")); return }
      onDone()
    } catch { setError(t("genericError")) } finally { setBusy(false) }
  }

  const inputCls = "rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[#2B3441]">{t("suggestTitle")}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className={inputCls} aria-label={t("newDate")} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-label={t("newTime")} />
      </div>
      {allowRateChange && (
        <>
          <input
            type="number"
            min={minHourlyRateCents / 100}
            step="0.5"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
            placeholder={t("newRatePlaceholder")}
            className={`${inputCls} w-full`}
          />
          <p className="text-xs text-[#9CA3AF]">{t("rateMinimumHint", { min: (minHourlyRateCents / 100).toFixed(2) })}</p>
        </>
      )}
      <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("messagePlaceholder")} className={`${inputCls} w-full resize-none`} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : t("sendSuggestion")}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-lg border border-[#E5EBF0] px-4 py-2 text-sm text-[#6B7280]">{t("back")}</button>
        )}
      </div>
    </div>
  )
}
