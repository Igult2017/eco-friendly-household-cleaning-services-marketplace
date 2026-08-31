"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, XCircle } from "lucide-react"

// A cleaner's own option to back out of a booking they already accepted (turning down a job BEFORE
// accepting it has its own flow — BookingRespondActions' reject mode). Posts to the same shared
// cancel endpoint the client's dedicated cancel page uses, so refund/fee logic only ever lives in
// one place. The server decides whether a reason is required (inside the late-cancellation window,
// live-configured by admin) — this just surfaces that error inline instead of duplicating the rule.
export function CancelBookingReport({ bookingId, onDone }: { bookingId: string; onDone?: () => void }) {
  const t = useTranslations("compBookingCancelReport")
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        const fieldMsg = typeof d.error === "object" ? d.error?.fieldErrors?.reason?.[0] : undefined
        setError(fieldMsg ?? (typeof d.error === "string" ? d.error : t("genericError")))
        return
      }
      onDone?.()
    } catch { setError(t("genericError")) } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-red-500 hover:text-red-700 underline transition-colors">
        {t("cancelBooking")}
      </button>
    )
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
        <XCircle size={13} /> {t("cancelBooking")}
      </p>
      <p className="text-xs text-red-700">{t("cancelWarning")}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reasonPlaceholder")}
        rows={2}
        className="w-full resize-none rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-[#2B3441] focus:outline-none focus:ring-1 focus:ring-red-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : t("confirmCancel")}
        </button>
        <button type="button" onClick={() => { setOpen(false); setReason(""); setError("") }} className="text-xs text-[#6B7280] hover:text-[#2B3441]">
          {t("dismiss")}
        </button>
      </div>
    </div>
  )
}
