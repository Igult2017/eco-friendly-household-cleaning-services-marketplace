import { Info } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function AffiliateDisclosure() {
  const t = await getTranslations("ecoStore")
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-[#E5EBF0] bg-white px-4 py-3 text-sm text-[#6B7280]">
      <Info size={16} className="mt-0.5 shrink-0 text-[#2D7A5F]" aria-hidden="true" />
      <p className="leading-relaxed">{t("disclosure")}</p>
    </div>
  )
}
