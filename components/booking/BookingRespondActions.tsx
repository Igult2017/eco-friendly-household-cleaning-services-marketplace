"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Check, PencilLine, X } from "lucide-react"

// Cleaner's response bar on a NEW booking: accept as-is, counter-offer (new date/time and/or hourly
// rate + message), or reject with a reason (full release of the client's hold).
export function BookingRespondActions({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const t = useTranslations("compBookingRespondActions")
  const [mode, setMode] = useState<"idle" | "suggest" | "reject">("idle")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [hourly, setHourly] = useState("")
  const [message, setMessage] = useState("")
  const [reason, setReason] = useState("")

  async function post(url: string, body: unknown) {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(typeof d.error === "string" ? d.error : t("genericError")); return false }
      onDone()
      return true
    } catch { setError(t("genericError")); return false } finally { setBusy(false) }
  }

  const accept = () => post(`/api/bookings/${bookingId}/confirm`, {})
  const reject = () => {
    if (reason.trim().length < 5) { setError(t("reasonTooShort")); return }
    post(`/api/bookings/${bookingId}/cancel`, { reason: reason.trim() })
  }
  const suggest = () => {
    const hourlyCents = hourly ? Math.round(parseFloat(hourly) * 100) : undefined
    const scheduledAt = date && time ? new Date(`${date}T${time}:00`).toISOString() : undefined
    if (!hourlyCents && !scheduledAt) { setError(t("suggestNothing")); return }
    post(`/api/bookings/${bookingId}/propose`, { scheduledAt, hourlyCents, message: message.trim() || undefined })
  }

  const inputCls = "rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"

  if (mode === "suggest") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#2B3441]">{t("suggestTitle")}</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className={inputCls} aria-label={t("newDate")} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-label={t("newTime")} />
        </div>
        <input type="number" min="1" step="0.5" value={hourly} onChange={(e) => setHourly(e.target.value)} placeholder={t("newRatePlaceholder")} className={`${inputCls} w-full`} />
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("messagePlaceholder")} className={`${inputCls} w-full resize-none`} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={suggest} disabled={busy} className="rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : t("sendSuggestion")}
          </button>
          <button onClick={() => { setMode("idle"); setError("") }} className="rounded-lg border border-[#E5EBF0] px-4 py-2 text-sm text-[#6B7280]">{t("back")}</button>
        </div>
      </div>
    )
  }

  if (mode === "reject") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#2B3441]">{t("rejectTitle")}</p>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} className={`${inputCls} w-full resize-none`} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={reject} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-700">
            {busy ? <Loader2 size={14} className="animate-spin" /> : t("confirmReject")}
          </button>
          <button onClick={() => { setMode("idle"); setError("") }} className="rounded-lg border border-[#E5EBF0] px-4 py-2 text-sm text-[#6B7280]">{t("back")}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={accept} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("accept")}
        </button>
        <button onClick={() => setMode("suggest")} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2D7A5F]/40 px-4 py-2 text-sm font-medium text-[#2D7A5F] hover:bg-[#F4FAF6] transition-colors">
          <PencilLine size={14} /> {t("suggestChanges")}
        </button>
        <button onClick={() => setMode("reject")} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          <X size={14} /> {t("reject")}
        </button>
      </div>
    </div>
  )
}
