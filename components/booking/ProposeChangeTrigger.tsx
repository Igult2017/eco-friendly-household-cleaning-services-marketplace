"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarClock } from "lucide-react"
import { ProposeChangeForm } from "./ProposeChangeForm"

// Collapsed "propose a change" button that expands into the actual form. Shared by the customer
// booking detail page and the provider booking list — same toggle behavior either side. onDone is
// optional — server-rendered pages don't need it (router.refresh() is enough), but the
// client-state-driven provider list passes its own reload function instead.
export function ProposeChangeTrigger({ bookingId, allowRateChange, fullWidth, onDone }: { bookingId: string; allowRateChange: boolean; fullWidth?: boolean; onDone?: () => void }) {
  const t = useTranslations("compBookingRespondActions")
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D7A5F]/30 text-[#2D7A5F] hover:bg-[#F4FAF6] text-sm font-medium px-4 py-3 transition-colors ${fullWidth ? "flex-1" : ""}`}
      >
        <CalendarClock size={15} /> {t("proposeChangeButton")}
      </button>
    )
  }
  return (
    <div className="rounded-2xl border border-[#E5EBF0] bg-white p-5 w-full">
      <ProposeChangeForm
        bookingId={bookingId}
        allowRateChange={allowRateChange}
        onCancel={() => setOpen(false)}
        onDone={() => { setOpen(false); onDone ? onDone() : router.refresh() }}
      />
    </div>
  )
}
