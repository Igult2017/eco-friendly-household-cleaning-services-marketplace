"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react"
import { useBookingStore } from "@/stores/bookingStore"

// Resume the checkout for an ACCEPTED bid — the accept-time store hydration is lost if the client
// navigates away, which left "booking in progress" with no way to actually pay.
export function CompleteBookingButton({ jobId, bookingId }: { jobId: string; bookingId: string | null }) {
  const t = useTranslations("compBiddingCompleteBooking")
  const router = useRouter()
  const setBidFlow = useBookingStore((s) => s.setBidFlow)
  const reset = useBookingStore((s) => s.reset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already paid — the booking exists; link straight to it.
  if (bookingId) {
    return (
      <Button size="sm" onClick={() => router.push(`/bookings/${bookingId}`)} className="h-8 text-xs bg-white border border-[#2D7A5F]/40 text-[#2D7A5F] hover:bg-[#EDF5F0]">
        <CheckCircle2 size={13} /> {t("viewBooking")}
      </Button>
    )
  }

  async function resume() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/checkout`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("failed")); return }
      if (data.booked) { router.push(`/bookings/${data.bookingId}`); return }
      reset()
      setBidFlow(data.bidFlow)
      router.push("/book/confirm")
    } catch {
      setError(t("failed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button size="sm" onClick={resume} disabled={loading} className="h-8 text-xs bg-[#2D7A5F] hover:bg-[#235f49] text-white">
        {loading ? <Loader2 size={13} className="animate-spin" /> : <>{t("completeBooking")} <ArrowRight size={13} /></>}
      </Button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
