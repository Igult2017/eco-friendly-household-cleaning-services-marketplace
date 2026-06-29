import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ShieldCheck, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TIER_CLASS, type Reliability } from "@/lib/provider/reliability"

export async function ReliabilityCard({ reliability }: { reliability: Reliability }) {
  const t = await getTranslations("compProviderReliabilityCard")
  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 shadow-sm">
      <p className="text-center text-sm font-medium text-[#6B7280]">{t("title")}</p>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#F4FAF6] py-3">
        <ShieldCheck size={18} className="text-[#2D7A5F]" />
        <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", TIER_CLASS[reliability.tier])}>
          {t(`tier_${reliability.tier}`)}
        </span>
        {reliability.tier !== "new" && (
          <span className="text-sm font-semibold text-[#2B3441]">{reliability.score}/100</span>
        )}
      </div>
      <Link
        href="/provider/statistics"
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] py-2.5 text-sm font-semibold text-white transition-colors"
      >
        <BarChart3 size={15} /> {t("viewStatistics")}
      </Link>
    </div>
  )
}
