"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Loader2, PencilLine } from "lucide-react"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"

type Proposal = { scheduledAt?: string; durationMinutes?: number; hourlyCents?: number; message?: string }

// Client-side banner on the booking page when the cleaner has counter-offered. Accept applies the
// change (a rate change re-authorizes the saved card); decline keeps the booking as originally agreed.
export function ProposalBanner({ bookingId, proposal, providerCountry }: { bookingId: string; proposal: Proposal; providerCountry: string }) {
  const t = useTranslations("compBookingProposalBanner")
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [error, setError] = useState("")

  async function respond(action: "accept" | "decline") {
    setBusy(action)
    setError("")
    try {
      const r = await fetch(`/api/bookings/${bookingId}/proposal-response`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(typeof d.error === "string" ? d.error : t("genericError")); return }
      router.refresh()
    } catch { setError(t("genericError")) } finally { setBusy(null) }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="mb-2 flex items-center gap-2">
        <PencilLine size={16} className="text-amber-600" />
        <p className="font-semibold text-[#2B3441]">{t("title")}</p>
      </div>
      <ul className="mb-3 space-y-1 text-sm text-[#2B3441]">
        {proposal.scheduledAt && (
          <li><span className="text-[#6B7280]">{t("newTime")}:</span> <strong>{new Date(proposal.scheduledAt).toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })}</strong></li>
        )}
        {proposal.hourlyCents && (
          <li><span className="text-[#6B7280]">{t("newRate")}:</span> <strong>{formatCurrencyForCountry(proposal.hourlyCents, providerCountry)}/h</strong></li>
        )}
        {proposal.message && <li className="italic text-[#6B7280]">“{proposal.message}”</li>}
      </ul>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => respond("accept")} disabled={!!busy} className="rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors">
          {busy === "accept" ? <Loader2 size={14} className="animate-spin" /> : t("accept")}
        </button>
        <button onClick={() => respond("decline")} disabled={!!busy} className="rounded-xl border border-[#E5EBF0] bg-white px-4 py-2 text-sm font-medium text-[#6B7280] disabled:opacity-50 hover:bg-gray-50 transition-colors">
          {busy === "decline" ? <Loader2 size={14} className="animate-spin" /> : t("decline")}
        </button>
      </div>
      {proposal.hourlyCents && <p className="mt-2 text-xs text-[#6B7280]">{t("rateNote")}</p>}
    </div>
  )
}
