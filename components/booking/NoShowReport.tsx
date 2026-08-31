"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, AlertTriangle } from "lucide-react"

// Self-report a no-show (the other party never showed / never became reachable). Only reachable
// once the booking is in an active state; the server enforces the grace-period wait and requires
// a reason — this UI just surfaces that server error inline rather than duplicating the check.
// Shared by the booking chat (CompletionBar), the customer booking detail page, and the provider
// booking list — one implementation, several mount points. Server-rendered pages don't need
// onDone (router.refresh() re-runs them); the provider list is client-state-driven and passes its
// own reload function instead, since router.refresh() wouldn't touch that local state.
export function NoShowReport({ bookingId, side, onDone }: { bookingId: string; side: "client" | "cleaner"; onDone?: () => void }) {
  const t = useTranslations("compBookingCompletionBar")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const endpoint = side === "cleaner" ? `/api/bookings/${bookingId}/no-show/client` : `/api/bookings/${bookingId}/no-show/cleaner`

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(typeof d.error === "string" ? d.error : t("genericError")); return }
      onDone ? onDone() : router.refresh()
    } catch { setError(t("genericError")) } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-[#9CA3AF] hover:text-[#6B7280] underline transition-colors">
        {side === "cleaner" ? t("reportClientNoShow") : t("reportCleanerNoShow")}
      </button>
    )
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <AlertTriangle size={13} /> {side === "cleaner" ? t("reportClientNoShow") : t("reportCleanerNoShow")}
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("noShowReasonPlaceholder")}
        rows={2}
        className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-[#2B3441] focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || reason.trim().length < 10}
          onClick={submit}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : t("noShowSubmit")}
        </button>
        <button type="button" onClick={() => { setOpen(false); setReason("") }} className="text-xs text-[#6B7280] hover:text-[#2B3441]">
          {t("noShowCancel")}
        </button>
      </div>
    </div>
  )
}
