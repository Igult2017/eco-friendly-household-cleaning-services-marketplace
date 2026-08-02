"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2, Zap } from "lucide-react"
import { useBookingStore } from "@/stores/bookingStore"

interface Props {
  jobId: string
}

// Instant claim for a "Take Job" (emergency) post — no bid form, no negotiation. First tap wins;
// mirrors AcceptBidButton.tsx's post-success handling since /api/jobs/[id]/take returns the same
// bidFlow shape the normal accept-bid route does.
export function TakeJobButton({ jobId }: Props) {
  const t = useTranslations("compBiddingTakeJobButton")
  const router = useRouter()
  const setBidFlow = useBookingStore((s) => s.setBidFlow)
  const reset = useBookingStore((s) => s.reset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTake() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/take`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("genericError")); return }

      if (data.bidFlow) {
        reset()
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
      <Button onClick={handleTake} disabled={loading} className="h-9 text-sm bg-red-600 hover:bg-red-700 text-white">
        {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Zap size={14} className="mr-1.5" />}
        {loading ? t("claiming") : t("takeThisJob")}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
