import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { XCircle } from "lucide-react"
import { formatDate } from "@/lib/utils/formatDate"
import { cn } from "@/lib/utils"

const STATUS: Record<string, { labelKey: string; cls: string }> = {
  cancelled:       { labelKey: "statusCancelled",    cls: "bg-gray-100 text-gray-500" },
  client_no_show:  { labelKey: "statusClientNoShow", cls: "bg-red-100 text-red-700" },
  cleaner_no_show: { labelKey: "statusCleanerNoShow", cls: "bg-red-100 text-red-700" },
}

type Booking = {
  id: string
  status: string
  scheduledAt: Date | string | null
  cancellationReason: string | null
  customer: { firstName: string | null; lastName: string | null } | null
  service: { name: string } | null
}

export async function ProviderDashboardCancelled({ bookings }: { bookings: Booking[] }) {
  const t = await getTranslations("compProviderProviderDashboardCancelled")
  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <XCircle size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
        <p className="text-sm text-[#6B7280]">{t("emptyDescription")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <XCircle size={16} className="text-[#9CA3AF]" /> {t("heading")}
        </h2>
        <Link href="/provider/bookings" className="text-xs text-[#2D7A5F] hover:underline">{t("viewAll")}</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {bookings.map((b) => {
          const cfg = STATUS[b.status] ?? STATUS.cancelled
          const name = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || t("defaultCustomer")
          return (
            <Link
              key={b.id}
              href={`/provider/bookings/${b.id}`}
              className="block px-5 py-4 transition-colors hover:bg-[#F4FAF6]"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <p className="font-medium text-[#2B3441] text-sm">{b.service?.name ?? t("defaultService")}</p>
                  <p className="text-xs text-[#6B7280]">{t("forCustomer", { name })}</p>
                  {b.scheduledAt && <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(b.scheduledAt)}</p>}
                </div>
                <Badge className={cn("text-xs flex-shrink-0", cfg.cls)}>{t(cfg.labelKey)}</Badge>
              </div>
              {b.cancellationReason && (
                <p className="text-xs text-[#6B7280] line-clamp-2">{b.cancellationReason}</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
