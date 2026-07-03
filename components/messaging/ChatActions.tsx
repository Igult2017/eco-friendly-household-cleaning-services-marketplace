"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { XCircle, LifeBuoy, Loader2, CheckCircle2, Hourglass } from "lucide-react"
import { CompleteBookingButton } from "@/components/bidding/CompleteBookingButton"

// Order controls living INSIDE every client↔cleaner chat:
// - no booking yet (job chat before checkout): activate-the-order panel (client) / waiting note (cleaner)
// - cancel the booking (client, while cancellable — tiered refund rules apply on the cancel page)
// - support: an inline panel that messages the DORIXÉ team without leaving the chat
export function ChatActions({
  side,
  bookingId,
  bookingStatus,
  jobId,
}: {
  side: "client" | "cleaner"
  bookingId?: string | null
  bookingStatus?: string | null
  jobId?: string
}) {
  const t = useTranslations("compChatActions")
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpBody, setHelpBody] = useState("")
  const [helpState, setHelpState] = useState<"idle" | "sending" | "sent">("idle")

  const cancellable =
    side === "client" && !!bookingId && ["pending_payment", "payment_authorized", "confirmed"].includes(bookingStatus ?? "")
  const noBookingYet = !!jobId && !bookingId

  async function sendHelp() {
    if (!helpBody.trim()) return
    setHelpState("sending")
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: helpBody.trim() }),
      })
      if (res.ok) { setHelpState("sent"); setHelpBody("") } else setHelpState("idle")
    } catch {
      setHelpState("idle")
    }
  }

  return (
    <div className="space-y-2">
      {/* The order only becomes actionable (complete/cancel/payment) once the booking exists. */}
      {noBookingYet && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Hourglass size={15} className="shrink-0 text-amber-600" />
          <p className="flex-1 text-xs text-amber-800">{side === "client" ? t("notActiveClient") : t("notActiveCleaner")}</p>
          {side === "client" && jobId && <CompleteBookingButton jobId={jobId} bookingId={null} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {cancellable && (
          <Link
            href={`/bookings/${bookingId}/cancel`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <XCircle size={13} /> {t("cancelBooking")}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EBF0] bg-white px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
        >
          <LifeBuoy size={13} /> {t("getHelp")}
        </button>
      </div>

      {/* Inline support: message the DORIXÉ team right here — no separate page. */}
      {helpOpen && (
        <div className="rounded-xl border border-[#E5EBF0] bg-white p-4">
          <p className="mb-2 text-xs font-semibold text-[#2B3441]">{t("helpTitle")}</p>
          {helpState === "sent" ? (
            <p className="flex items-center gap-2 text-xs font-medium text-[#2D7A5F]">
              <CheckCircle2 size={14} /> {t("helpSent")}
            </p>
          ) : (
            <>
              <textarea
                value={helpBody}
                onChange={(e) => setHelpBody(e.target.value)}
                placeholder={t("helpPlaceholder")}
                rows={3}
                className="mb-2 w-full resize-none rounded-lg border border-[#E5EBF0] bg-white px-3 py-2 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendHelp}
                  disabled={helpState === "sending" || !helpBody.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D7A5F] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#235f49] disabled:opacity-50"
                >
                  {helpState === "sending" ? <Loader2 size={12} className="animate-spin" /> : null} {t("helpSend")}
                </button>
                <Link href={side === "client" ? "/support" : "/provider/support"} className="text-xs text-[#6B7280] underline hover:text-[#2B3441]">
                  {t("helpOpenFull")}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
