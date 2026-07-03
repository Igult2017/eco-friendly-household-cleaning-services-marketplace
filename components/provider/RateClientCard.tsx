"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Star, CheckCircle2, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// Two-way reviews: after a completed booking the CLEANER rates the client. The rating feeds the
// "About the client" trust panel other cleaners see before bidding on that client's jobs.
export function RateClientCard({ bookingId, alreadyReviewed }: { bookingId: string; alreadyReviewed: boolean }) {
  const t = useTranslations("providerProviderBookingsPage")
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "done">(alreadyReviewed ? "done" : "idle")
  const [error, setError] = useState<string | null>(null)

  if (state === "done") {
    return (
      <p className="mt-3 flex items-center gap-2 border-t border-[#E5EBF0] pt-3 text-xs font-medium text-[#2D7A5F]">
        <CheckCircle2 size={14} /> {t("rateClientDone")}
      </p>
    )
  }

  async function submit() {
    if (rating < 1) return
    setState("saving"); setError(null)
    try {
      const res = await fetch("/api/provider/customer-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, body: body.trim() || undefined }),
      })
      if (!res.ok && res.status !== 409) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === "string" ? d.error : t("rateClientFailed"))
        setState("idle")
        return
      }
      setState("done")
    } catch {
      setError(t("rateClientFailed"))
      setState("idle")
    }
  }

  return (
    <div className="mt-3 border-t border-[#E5EBF0] pt-3">
      <p className="mb-2 text-xs font-semibold text-[#2B3441]">{t("rateClientTitle")}</p>
      <div className="mb-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} / 5`}
            className="p-0.5"
          >
            <Star size={20} className={(hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-[#D1D5DB]"} />
          </button>
        ))}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("rateClientPlaceholder")} rows={2} className="mb-2 resize-none bg-white text-sm" />
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <Button onClick={submit} disabled={rating < 1 || state === "saving"} className="h-9 bg-[#2D7A5F] px-4 text-sm text-white hover:bg-[#235f49]">
        {state === "saving" ? <><Loader2 size={13} className="mr-2 animate-spin" />{t("rateClientSaving")}</> : t("rateClientSubmit")}
      </Button>
    </div>
  )
}
