"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2, Zap, CheckCircle2 } from "lucide-react"

interface Props {
  jobId: string
}

// Instant claim for a "Take Job" (emergency) post — no bid form, no negotiation. First tap wins.
// The CLEANER clicks this, not the client, so there's nothing to redirect to here — payment is the
// CLIENT's step, surfaced directly on their own /jobs page (see CompleteBookingButton there). This
// used to copy AcceptBidButton.tsx's post-success redirect to /book/confirm, which was wrong: that
// only makes sense when the caller IS the payer, which is never true for a claim.
export function TakeJobButton({ jobId }: Props) {
  const t = useTranslations("compBiddingTakeJobButton")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)

  async function handleTake() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/take`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("genericError")); return }
      setClaimed(true)
    } catch {
      setError(t("genericError"))
    } finally {
      setLoading(false)
    }
  }

  if (claimed) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[#2D7A5F]">
        <CheckCircle2 size={16} /> {t("claimed")}
      </div>
    )
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
