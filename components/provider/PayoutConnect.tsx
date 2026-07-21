"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CreditCard, CheckCircle } from "lucide-react"
import { StripeConnectEmbed } from "./StripeConnectEmbed"

// Surfaces the cleaner's Stripe Connect payout setup. Shown on the earnings page (always) and the
// dashboard (only when not yet connected). A cleaner cannot be paid — and customers can't even be
// charged (destination charges) — until this is "active". The onboarding form itself renders inline
// via Stripe's embedded component (StripeConnectEmbed) — no redirect off the DORIXÉ site.
export function PayoutConnect({ status }: { status: string | null }) {
  const t = useTranslations("compOnboardingProviderPayoutStep")
  const router = useRouter()

  const active = status === "active" || status === "charges_enabled"

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
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#2B3441] text-sm">{t("title")}</p>
          <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{t("description")}</p>
        </div>
      </div>
      <StripeConnectEmbed onConnected={() => router.refresh()} />
    </div>
  )
}
