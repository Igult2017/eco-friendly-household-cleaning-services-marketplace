"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { CreditCard, CheckCircle, ExternalLink, AlertCircle } from "lucide-react"

// Surfaces the cleaner's Stripe Connect payout setup (the previously-orphaned ProviderPayoutStep flow).
// Shown on the earnings page (always) and the dashboard (only when not yet connected). A cleaner cannot
// be paid — and customers can't even be charged (destination charges) — until this is "active".
export function PayoutConnect({ status }: { status: string | null }) {
  const t = useTranslations("compOnboardingProviderPayoutStep")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = status === "active" || status === "charges_enabled"

  async function connect() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/connect/account", { method: "POST" })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      if (!url) throw new Error()
      window.location.href = url // Stripe-hosted onboarding; returns to /provider/earnings
    } catch {
      setError(t("connectError"))
      setLoading(false)
    }
  }

  if (active) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800 text-sm">{t("successTitle")}</p>
          <p className="text-xs text-green-700">{t("successDescription")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#2B3441] text-sm">{t("title")}</p>
          <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{t("description")}</p>
          {error && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <Button onClick={connect} disabled={loading} className="mt-3 bg-[#2D7A5F] hover:bg-[#235f49] text-white h-10">
            <ExternalLink className="w-4 h-4 mr-2" />
            {loading ? t("connecting") : t("connectButton")}
          </Button>
        </div>
      </div>
    </div>
  )
}
