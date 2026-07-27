"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, Hourglass, CreditCard, AlertTriangle } from "lucide-react"

interface Props {
  bookingId: string
  side: "client" | "cleaner"
  status: string
  providerCompleted: boolean
  clientConfirmed: boolean
}

// Dual-confirm completion, embedded in the booking chat. BOTH parties must press their button:
// the cleaner marks done first, the client confirms — only then does the order close (and payment
// capture, when a card is on file). One side alone can never close the chat or the order.
export function CompletionBar({ bookingId, side, status, providerCompleted, clientConfirmed }: Props) {
  const t = useTranslations("compBookingCompletionBar")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showNoShow, setShowNoShow] = useState(false)
  const [noShowReason, setNoShowReason] = useState("")

  async function post(url: string, body: object = {}) {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(typeof d.error === "string" ? d.error : t("genericError")); return }
      router.refresh()
    } catch { setError(t("genericError")) } finally { setBusy(false) }
  }

  // Self-report a no-show (the other party never showed / never became reachable). Only reachable
  // once the booking is in an active state; the server enforces the grace-period wait and requires
  // a reason — this UI just surfaces that server error inline rather than duplicating the check.
  function noShowPanel() {
    const endpoint = side === "cleaner" ? `/api/bookings/${bookingId}/no-show/client` : `/api/bookings/${bookingId}/no-show/cleaner`
    if (!showNoShow) {
      return (
        <button type="button" onClick={() => setShowNoShow(true)} className="text-xs text-[#9CA3AF] hover:text-[#6B7280] underline transition-colors">
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
          value={noShowReason}
          onChange={(e) => setNoShowReason(e.target.value)}
          placeholder={t("noShowReasonPlaceholder")}
          rows={2}
          className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-[#2B3441] focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || noShowReason.trim().length < 10}
            onClick={() => post(endpoint, { reason: noShowReason.trim() })}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : t("noShowSubmit")}
          </button>
          <button type="button" onClick={() => { setShowNoShow(false); setNoShowReason("") }} className="text-xs text-[#6B7280] hover:text-[#2B3441]">
            {t("noShowCancel")}
          </button>
        </div>
      </div>
    )
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[#EDF5F0] px-4 py-3 text-sm font-semibold text-[#2D7A5F]">
        <CheckCircle2 size={16} /> {t("completedClosed")}
      </div>
    )
  }
  if (status === "cancelled" || status === "refunded" || status === "disputed") return null

  // No payment method on file yet: the cleaner must NOT take/complete the order; the client is
  // pushed to add a card so payment can always be deducted automatically at completion.
  if (status === "pending_payment") {
    if (side === "client") {
      return (
        <div className="space-y-1.5">
          <Link href={`/bookings/${bookingId}/pay`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors">
            <CreditCard size={14} /> {t("addPayment")}
          </Link>
          <p className="text-xs text-[#6B7280]">{t("addPaymentNote")}</p>
        </div>
      )
    }
    return (
      <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <CreditCard size={14} className="shrink-0" /> {t("noCardCleanerWait")}
      </p>
    )
  }

  const active = ["payment_authorized", "confirmed", "in_progress"].includes(status)

  if (side === "cleaner") {
    if (active) {
      return (
        <div className="space-y-1.5">
          <button onClick={() => post(`/api/bookings/${bookingId}/complete`)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t("markDone")}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {noShowPanel()}
        </div>
      )
    }
    if (status === "pending_capture" && !clientConfirmed) {
      return (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Hourglass size={14} /> {t("waitingClient")}
        </p>
      )
    }
    return null
  }

  // Client side
  if (status === "pending_capture" && providerCompleted && !clientConfirmed) {
    return (
      <div className="space-y-1.5">
        <button onClick={() => post(`/api/bookings/${bookingId}/confirm-completion`)} disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t("confirmDone")}
        </button>
        <p className="text-xs text-[#6B7280]">{t("confirmReleasesPayment")}</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
  if (active) {
    return (
      <div className="space-y-1.5">
        <p className="rounded-xl bg-[#F4FAF6] px-4 py-3 text-xs text-[#6B7280]">{t("cleanerFirstHint")}</p>
        {noShowPanel()}
      </div>
    )
  }
  return null
}
