"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, Hourglass } from "lucide-react"

interface Props {
  bookingId: string
  side: "client" | "cleaner"
  status: string
  providerCompleted: boolean
  clientConfirmed: boolean
  hasPayment: boolean
}

// Dual-confirm completion, embedded in the booking chat. BOTH parties must press their button:
// the cleaner marks done first, the client confirms — only then does the order close (and payment
// capture, when a card is on file). One side alone can never close the chat or the order.
export function CompletionBar({ bookingId, side, status, providerCompleted, clientConfirmed, hasPayment }: Props) {
  const t = useTranslations("compBookingCompletionBar")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function post(url: string) {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(typeof d.error === "string" ? d.error : t("genericError")); return }
      router.refresh()
    } catch { setError(t("genericError")) } finally { setBusy(false) }
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[#EDF5F0] px-4 py-3 text-sm font-semibold text-[#2D7A5F]">
        <CheckCircle2 size={16} /> {t("completedClosed")}{!hasPayment && <span className="font-normal text-[#6B7280]"> — {t("settleDirect")}</span>}
      </div>
    )
  }
  if (status === "cancelled" || status === "refunded" || status === "disputed") return null

  const active = ["pending_payment", "payment_authorized", "confirmed", "in_progress"].includes(status)

  if (side === "cleaner") {
    if (active) {
      return (
        <div className="space-y-1.5">
          <button onClick={() => post(`/api/bookings/${bookingId}/complete`)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t("markDone")}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
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
        <p className="text-xs text-[#6B7280]">{hasPayment ? t("confirmReleasesPayment") : t("confirmNoCardNote")}</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
  if (active) {
    return <p className="rounded-xl bg-[#F4FAF6] px-4 py-3 text-xs text-[#6B7280]">{t("cleanerFirstHint")}</p>
  }
  return null
}
