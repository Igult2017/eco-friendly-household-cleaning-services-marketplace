"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Star, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div>
      <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
          >
            <Star
              size={28}
              className={cn(
                "transition-colors",
                (hovered || value) >= star ? "fill-amber-400 text-amber-400" : "text-[#E5EBF0]"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const t = useTranslations("customerBookingsIdReviewPage")
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const bookingId = params.id

  const [overall, setOverall] = useState(0)
  const [cleanliness, setCleanliness] = useState(0)
  const [punctuality, setPunctuality] = useState(0)
  const [eco, setEco] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (overall === 0) { setError(t("errorSelectOverallRating")); return }
    setSubmitting(true)
    setError(null)

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        overallRating: overall,
        cleanlinessRating: cleanliness || undefined,
        punctualityRating: punctuality || undefined,
        ecoComplianceRating: eco || undefined,
        communicationRating: communication || undefined,
        title: title || undefined,
        body: body || undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? t("errorSubmitFailed")); setSubmitting(false); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] flex flex-col items-center justify-center px-4 py-20">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] text-center mb-2">{t("thankYouTitle")}</h1>
        <p className="text-[#6B7280] text-center mb-8">{t("thankYouSubtitle")}</p>
        <Button onClick={() => router.push("/dashboard")} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white px-8 h-11">
          {t("backToDashboard")}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">{t("pageTitle")}</h1>
        <p className="text-[#6B7280] mb-8">{t("pageSubtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 space-y-5">
            <StarRating value={overall} onChange={setOverall} label={t("overallRatingLabel")} />
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F4FAF6]">
              <StarRating value={cleanliness} onChange={setCleanliness} label={t("cleanlinessLabel")} />
              <StarRating value={punctuality} onChange={setPunctuality} label={t("punctualityLabel")} />
              <StarRating value={eco} onChange={setEco} label={t("ecoComplianceLabel")} />
              <StarRating value={communication} onChange={setCommunication} label={t("communicationLabel")} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("reviewTitleLabel")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("reviewTitlePlaceholder")} maxLength={200} />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("experienceLabel")}</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("experiencePlaceholder")}
                rows={5}
                maxLength={2000}
                className="resize-none"
              />
              <p className="text-xs text-[#9CA3AF] mt-1">{t("characterCount", { count: body.length })}</p>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold">
            {submitting ? <><Loader2 size={16} className="animate-spin mr-2" /> {t("submitting")}</> : t("submitReview")}
          </Button>
        </form>
      </div>
    </div>
  )
}
