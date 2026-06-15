"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useBookingStore } from "@/stores/bookingStore"

interface Props {
  jobId: string
  bidId: string
}

export function AcceptBidButton({ jobId, bidId }: Props) {
  const t = useTranslations("compBiddingAcceptBidButton")
  const router = useRouter()
  const setBidFlow = useBookingStore((s) => s.setBidFlow)
  const reset = useBookingStore((s) => s.reset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/bids/${bidId}/accept`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("failedToAccept")); return }

      // Bug 5: pre-populate the booking store with bid data so the confirm page
      // bypasses the wizard steps (category → location → provider → schedule)
      if (data.bidFlow) {
        reset()  // clear any previous wizard state
        setBidFlow(data.bidFlow)
      }

      router.push(data.redirectTo ?? "/dashboard")
    } catch {
      setError(t("genericError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        onClick={handleAccept}
        disabled={loading}
        size="sm"
        className="mt-1 h-7 text-xs bg-[#2D7A5F] hover:bg-[#235f49] text-white"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : t("accept")}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
