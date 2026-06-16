"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Star, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// Lets a provider rate the customer after completing a booking (two-way reviews).
export function RateCustomerForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("compReviewsRateCustomer")
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (rating < 1) { setError(t("pickRating")); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/provider/customer-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, body: body.trim() || undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? t("failed"))
        return
      }
      setDone(true)
    } catch {
      setError(t("failed"))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-[#2D7A5F]/20 bg-[#EDF5F0] px-5 py-4 text-center text-sm text-[#2B3441]">
        <CheckCircle2 size={18} className="mx-auto mb-1 text-[#2D7A5F]" />
        {t("thanks")}
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-[#E5EDE9] bg-white px-5 py-4 text-left">
      <p className="text-sm font-semibold text-[#2B3441]">{t("heading")}</p>
      <p className="text-xs text-[#6B7280] mb-3">{t("subtitle")}</p>

      <div className="flex items-center gap-1 mb-3" role="radiogroup" aria-label={t("heading")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}`}
            aria-checked={rating === n}
            role="radio"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <Star
              size={26}
              className={(hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-gray-300"}
            />
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={t("placeholder")}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F] resize-none mb-2"
      />

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <Button onClick={submit} disabled={submitting} className="w-full h-9 bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm">
        {submitting ? <Loader2 size={15} className="animate-spin" /> : t("submit")}
      </Button>
    </div>
  )
}
