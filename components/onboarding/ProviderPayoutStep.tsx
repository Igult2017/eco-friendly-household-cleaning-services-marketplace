"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { CreditCard, CheckCircle } from "lucide-react"
import { StripeConnectEmbed } from "@/components/provider/StripeConnectEmbed"

interface Props {
  onConnected: () => void
  onSkip: () => void
}

export function ProviderPayoutStep({ onConnected, onSkip }: Props) {
  const t = useTranslations("compOnboardingProviderPayoutStep")

  return (
    <div className="py-4">
      <div className="text-center mb-5">
        <div className="w-16 h-16 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-5">
          <CreditCard className="w-8 h-8 text-[#2D7A5F]" />
        </div>
        <h2 className="text-lg font-semibold text-[#2B3441] mb-2">{t("title")}</h2>
        <p className="text-sm text-[#6B7280] max-w-sm mx-auto leading-relaxed">{t("description")}</p>
      </div>

      <div className="bg-[#F4FAF6] rounded-xl p-4 border border-[#E5EDE9] text-left mb-6 space-y-2">
        {[t("benefitInstantPayout"), t("benefitDirectTransfer"), t("benefitTransparency"), t("benefitNoFees")].map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-[#2B3441]">
            <CheckCircle className="w-3.5 h-3.5 text-[#2D7A5F] flex-shrink-0" />
            {item}
          </div>
        ))}
      </div>

      <StripeConnectEmbed onConnected={onConnected} />

      <Button variant="ghost" onClick={onSkip} className="w-full text-[#6B7280] hover:text-[#2B3441] text-sm mt-4">
        {t("skip")}
      </Button>
      <p className="text-xs text-[#6B7280] mt-4 text-center">{t("footnote")}</p>
    </div>
  )
}
