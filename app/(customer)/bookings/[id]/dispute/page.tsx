"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, Loader2 } from "lucide-react"

const REASONS = [
  { value: "service_not_performed", labelKey: "reasonServiceNotPerformed" },
  { value: "poor_quality", labelKey: "reasonPoorQuality" },
  { value: "no_show", labelKey: "reasonNoShow" },
  { value: "property_damage", labelKey: "reasonPropertyDamage" },
  { value: "wrong_price", labelKey: "reasonWrongPrice" },
  { value: "eco_non_compliance", labelKey: "reasonEcoNonCompliance" },
  { value: "other", labelKey: "reasonOther" },
]

export default function OpenDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = use(params)
  const router = useRouter()
  const t = useTranslations("customerBookingsIdDisputePage")
  const [isPending, startTransition] = useTransition()

  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!reason || description.length < 20) {
      setError(t("validationSelectReasonAndDescribe"))
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, reason, description, evidenceUrls: [] }),
      })
      if (res.ok) {
        router.push("/dashboard")
      } else {
        const d = await res.json()
        setError(d.error ?? t("errorFailedToOpenDispute"))
      }
    })
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{t("title")}</h1>
          <p className="text-sm text-[#6B7280]">{t("subtitle")}</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
        <strong>{t("beforeYouContinueLabel")}</strong> {t("beforeYouContinueText")}
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-2">{t("reasonLabel")}</label>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                  reason === r.value
                    ? "border-[#2D7A5F] bg-[#2D7A5F]/5 text-[#2D7A5F] font-medium"
                    : "border-gray-200 text-[#6B7280] hover:border-gray-300 hover:text-[#2B3441]"
                }`}
              >
                {t(r.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-2">
            {t("describeIssueLabel")} <span className="text-[#6B7280] font-normal">{t("describeIssueHint")}</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder={t("describeIssuePlaceholder")}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F] resize-none"
          />
          <p className="text-xs text-[#6B7280] mt-1">{description.length} / 2000</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-[#6B7280] hover:bg-gray-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={submit}
            disabled={isPending}
            className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? t("submitting") : t("openDispute")}
          </button>
        </div>
      </div>
    </div>
  )
}
