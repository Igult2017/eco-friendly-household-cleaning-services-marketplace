import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { cn } from "@/lib/utils"

const PAYOUT_STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending:    { labelKey: "statusPending",    cls: "bg-amber-100 text-amber-700" },
  processing: { labelKey: "statusProcessing", cls: "bg-blue-100 text-blue-700" },
  paid:       { labelKey: "statusPaid",       cls: "bg-green-100 text-green-700" },
  failed:     { labelKey: "statusFailed",     cls: "bg-red-100 text-red-700" },
}

type Payout = {
  id: string
  status: string
  amount: number
  periodStart: string
  periodEnd: string
  processedAt: Date | string | null
}

export async function ProviderDashboardEarnings({
  totalEarnings,
  pendingPayout,
  recentPayouts,
}: {
  totalEarnings: number
  pendingPayout: number
  recentPayouts: Payout[]
}) {
  const t = await getTranslations("compProviderProviderDashboardEarnings")
  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <TrendingUp size={16} className="text-[#2D7A5F]" /> {t("title")}
        </h2>
        <Link href="/provider/earnings" className="text-xs text-[#2D7A5F] hover:underline">{t("fullReport")}</Link>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 divide-x divide-[#F0F4F8] border-b border-[#F0F4F8]">
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B7280] mb-1">{t("totalEarned")}</p>
          <p className="text-xl font-bold text-[#2B3441]">{formatCurrency(totalEarnings)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#6B7280] mb-1">{t("awaitingPayout")}</p>
          <p className={cn("text-xl font-bold", pendingPayout > 0 ? "text-[#2D7A5F]" : "text-[#9CA3AF]")}>
            {formatCurrency(pendingPayout)}
          </p>
          {pendingPayout > 0 && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">{t("paidWeekly")}</p>
          )}
        </div>
      </div>

      {/* Recent payouts */}
      {recentPayouts.length > 0 ? (
        <div className="divide-y divide-[#F0F4F8]">
          {recentPayouts.map((p) => {
            const cfg = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.pending
            return (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#2B3441]">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {p.periodStart} – {p.periodEnd}
                  </p>
                </div>
                <Badge className={cn("text-xs", cfg.cls)}>{t(cfg.labelKey)}</Badge>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-[#9CA3AF]">{t("emptyPayouts")}</p>
      )}
    </div>
  )
}
