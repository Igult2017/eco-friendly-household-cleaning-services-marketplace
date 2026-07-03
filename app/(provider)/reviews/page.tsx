"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Loader2, MessageSquare } from "lucide-react"
import { BackButton } from "@/components/ui/BackButton"

type Review = {
  id: string
  overallRating: number
  title: string | null
  body: string | null
  providerResponse: string | null
  createdAt: string
  customerEmail?: string
}

export default function ProviderReviewsPage() {
  const t = useTranslations("providerReviewsPage")
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)
  const [responseText, setResponseText] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/provider/reviews").then((r) => r.json()).then((d) => { setReviews(d.reviews ?? []); setLoading(false) })
  }, [])

  const submitResponse = async (reviewId: string) => {
    if (responseText.length < 10) return
    setSaving(true)
    await fetch(`/api/reviews/${reviewId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: responseText }),
    })
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, providerResponse: responseText } : r))
    setResponding(null)
    setResponseText("")
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-1"><BackButton fallback="/provider/dashboard" /></div>
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("title")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#2D7A5F]" /></div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl bg-white shadow-sm py-16 text-center">
          <p className="text-[#6B7280] text-sm">{t("emptyState")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl bg-white shadow-sm p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#2B3441]">{t("ratingValue", { rating: r.overallRating })}</span>
                    {r.title && <span className="font-medium text-sm text-[#2B3441]">{r.title}</span>}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">{new Date(r.createdAt).toLocaleDateString("de-DE")}</p>
                </div>
                {!r.providerResponse && responding !== r.id && (
                  <button onClick={() => { setResponding(r.id); setResponseText("") }} className="flex items-center gap-1.5 text-xs text-[#2D7A5F] hover:underline font-medium">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t("respond")}
                  </button>
                )}
              </div>

              {r.body && <p className="text-sm text-[#6B7280] leading-relaxed">{r.body}</p>}

              {r.providerResponse && (
                <div className="rounded-lg bg-[#F4FAF6] border border-[#2D7A5F]/20 px-4 py-3">
                  <p className="text-xs font-semibold text-[#2D7A5F] mb-1">{t("yourResponse")}</p>
                  <p className="text-sm text-[#2B3441] leading-relaxed">{r.providerResponse}</p>
                </div>
              )}

              {responding === r.id && (
                <div className="space-y-3">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={3}
                    placeholder={t("responsePlaceholder")}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F] resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setResponding(null)} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-[#6B7280] hover:bg-gray-50">{t("cancel")}</button>
                    <button onClick={() => submitResponse(r.id)} disabled={saving || responseText.length < 10} className="flex-1 rounded-lg bg-[#2D7A5F] py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors flex items-center justify-center gap-2">
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {saving ? t("saving") : t("postResponse")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
