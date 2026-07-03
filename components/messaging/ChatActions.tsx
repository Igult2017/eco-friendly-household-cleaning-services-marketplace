"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { XCircle, LifeBuoy } from "lucide-react"

// Order controls under every client↔cleaner chat: cancel the booking (client side, while it's
// still cancellable — the cancel page applies the tiered refund rules) and a direct line to
// DORIXÉ support for help with the task.
export function ChatActions({
  side,
  bookingId,
  bookingStatus,
}: {
  side: "client" | "cleaner"
  bookingId?: string | null
  bookingStatus?: string | null
}) {
  const t = useTranslations("compChatActions")
  const cancellable =
    side === "client" && !!bookingId && ["pending_payment", "payment_authorized", "confirmed"].includes(bookingStatus ?? "")

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cancellable && (
        <Link
          href={`/bookings/${bookingId}/cancel`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <XCircle size={13} /> {t("cancelBooking")}
        </Link>
      )}
      <Link
        href={side === "client" ? "/support" : "/provider/support"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EBF0] bg-white px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
      >
        <LifeBuoy size={13} /> {t("getHelp")}
      </Link>
    </div>
  )
}
