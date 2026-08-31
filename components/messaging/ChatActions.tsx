"use client"

import { XCircle, Hourglass } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CompleteBookingButton } from "@/components/bidding/CompleteBookingButton"
import { ContactSupportPanel } from "@/components/messaging/ContactSupportPanel"

// Order controls living INSIDE every client↔cleaner chat:
// - no booking yet (job chat before checkout): activate-the-order panel (client) / waiting note (cleaner)
// - cancel the booking (client, while cancellable — tiered refund rules apply on the cancel page)
// - support: message the DORIXÉ team about this specific booking without leaving the chat
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

  const cancellable =
    side === "client" && !!bookingId && ["pending_payment", "payment_authorized", "confirmed"].includes(bookingStatus ?? "")
  const noBookingYet = !!jobId && !bookingId

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
        <ContactSupportPanel side={side} bookingId={bookingId ?? undefined} />
      </div>
    </div>
  )
}
