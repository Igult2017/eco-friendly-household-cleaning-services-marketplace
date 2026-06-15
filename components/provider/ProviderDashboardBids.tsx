import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Gavel } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { cn } from "@/lib/utils"

const BID_STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending:   { labelKey: "statusPending",   cls: "bg-amber-100 text-amber-700" },
  accepted:  { labelKey: "statusAccepted",  cls: "bg-green-100 text-green-700" },
  rejected:  { labelKey: "statusRejected",  cls: "bg-red-100 text-red-700" },
  withdrawn: { labelKey: "statusWithdrawn", cls: "bg-gray-100 text-gray-500" },
}

type Bid = {
  id: string
  status: string
  amount: number
  createdAt: Date | string
  jobPost: {
    title: string
    status: string
    serviceAddress: { city?: string } | null
  } | null
}

export async function ProviderDashboardBids({ bids }: { bids: Bid[] }) {
  const t = await getTranslations("compProviderProviderDashboardBids")

  if (bids.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <Gavel size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
        <p className="text-sm text-[#6B7280] mb-4">{t("emptyDescription")}</p>
        <Link href="/provider/jobs" className="text-sm font-medium text-[#2D7A5F] hover:underline">
          {t("findJobs")}
        </Link>
      </div>
    )
  }

  const pending  = bids.filter((b) => b.status === "pending").length
  const accepted = bids.filter((b) => b.status === "accepted").length

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <Gavel size={16} className="text-[#2D7A5F]" /> {t("title")}
          {pending > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {t("pendingBadge", { count: pending })}
            </span>
          )}
        </h2>
        <Link href="/provider/jobs" className="text-xs text-[#2D7A5F] hover:underline">{t("browseJobs")}</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {bids.map((bid) => {
          const cfg = BID_STATUS[bid.status] ?? BID_STATUS.pending
          const city = (bid.jobPost?.serviceAddress as { city?: string } | null)?.city
          return (
            <div key={bid.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#2B3441] truncate">
                  {bid.jobPost?.title ?? t("jobPostRemoved")}
                </p>
                {city && <p className="text-xs text-[#9CA3AF]">{city}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-[#2B3441]">{formatCurrency(bid.amount)}</span>
                <Badge className={cn("text-xs", cfg.cls)}>{t(cfg.labelKey)}</Badge>
              </div>
            </div>
          )
        })}
      </div>
      {accepted > 0 && (
        <div className="px-5 py-3 bg-[#F4FAF6] text-xs text-[#2D7A5F] font-medium">
          {t("acceptedNotice", { count: accepted })}
        </div>
      )}
    </div>
  )
}
