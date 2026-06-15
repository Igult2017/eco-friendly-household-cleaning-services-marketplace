"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { CreditCard, CheckCircle, ExternalLink, AlertCircle } from "lucide-react"

interface Props {
  onComplete: () => void
  onSkip: () => void
}

export function ProviderPayoutStep({ onComplete, onSkip }: Props) {
  const t = useTranslations("compOnboardingProviderPayoutStep")
  const searchParams = useSearchParams()
  const isSuccess = searchParams.get("success") === "1"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connectStripe() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/connect/account", { method: "POST" })
      if (!res.ok) throw new Error("Failed to start Stripe Connect")
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setError(t("connectError"))
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-[#2D7A5F]" />
        </div>
        <h2 className="text-lg font-semibold text-[#2B3441] mb-2">{t("successTitle")}</h2>
        <p className="text-sm text-[#6B7280] mb-6">
          {t("successDescription")}
        </p>
        <Button onClick={onComplete} className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11">
          {t("goToDashboard")}
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-5">
        <CreditCard className="w-8 h-8 text-[#2D7A5F]" />
      </div>
      <h2 className="text-lg font-semibold text-[#2B3441] mb-2">{t("title")}</h2>
      <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto leading-relaxed">
        {t("description")}
      </p>

      <div className="bg-[#F4FAF6] rounded-xl p-4 border border-[#E5EDE9] text-left mb-6 space-y-2">
        {[
          t("benefitWeeklyPayouts"),
          t("benefitDirectTransfer"),
          t("benefitTransparency"),
          t("benefitNoFees"),
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-[#2B3441]">
            <CheckCircle className="w-3.5 h-3.5 text-[#2D7A5F] flex-shrink-0" />
            {item}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={connectStripe}
          disabled={loading}
          className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {loading ? t("connecting") : t("connectButton")}
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full text-[#6B7280] hover:text-[#2B3441] text-sm">
          {t("skip")}
        </Button>
      </div>
      <p className="text-xs text-[#6B7280] mt-4">
        {t("footnote")}
      </p>
    </div>
  )
}
