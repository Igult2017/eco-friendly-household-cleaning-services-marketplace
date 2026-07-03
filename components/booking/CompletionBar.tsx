"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, Hourglass, CreditCard } from "lucide-react"

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
    return <p className="rounded-xl bg-[#F4FAF6] px-4 py-3 text-xs text-[#6B7280]">{t("cleanerFirstHint")}</p>
  }
  return null
}
