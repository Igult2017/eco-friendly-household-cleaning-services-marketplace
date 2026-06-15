import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, MapPin } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { cn } from "@/lib/utils"

const STATUS: Record<string, { labelKey: string; cls: string }> = {
  payment_authorized: { labelKey: "statusUpcoming",   cls: "bg-blue-100 text-blue-700" },
  confirmed:          { labelKey: "statusConfirmed",  cls: "bg-blue-100 text-blue-700" },
  in_progress:        { labelKey: "statusInProgress", cls: "bg-[#D1F0E0] text-[#2D7A5F]" },
}

type Booking = {
  id: string
  status: string
  scheduledAt: Date | string | null
  providerPayout: number
  serviceAddress: { line1?: string; city?: string } | null
  customer: { firstName: string | null; lastName: string | null } | null
  service: { name: string } | null
}

export async function ProviderDashboardSchedule({ bookings }: { bookings: Booking[] }) {
  const t = await getTranslations("compProviderProviderDashboardSchedule")
  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <CalendarDays size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
        <p className="text-sm text-[#6B7280]">{t("emptyDescription")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <CalendarDays size={16} className="text-[#2D7A5F]" /> {t("heading")}
        </h2>
        <Link href="/provider/bookings" className="text-xs text-[#2D7A5F] hover:underline">{t("viewAll")}</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {bookings.map((b) => {
          const cfg = STATUS[b.status] ?? STATUS.confirmed
          const name = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || t("defaultCustomer")
          const addr = b.serviceAddress
          return (
            <div key={b.id} className="px-5 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[#2B3441] text-sm">{b.service?.name ?? t("defaultService")}</p>
                <p className="text-xs text-[#6B7280]">{t("forCustomer", { name })}</p>
                {b.scheduledAt && (
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(b.scheduledAt)}</p>
                )}
                {addr?.city && (
                  <p className="text-xs text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {addr.line1 ? `${addr.line1}, ` : ""}{addr.city}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Badge className={cn("text-xs", cfg.cls)}>{t(cfg.labelKey)}</Badge>
                <p className="text-sm font-bold text-[#2D7A5F]">{formatCurrency(b.providerPayout)}</p>
                <Link href={`/provider/bookings/${b.id}/complete`}>
                  <Button size="sm" className="bg-[#2D7A5F] hover:bg-[#235f49] text-white text-xs h-7">
                    {t("markDone")}
                  </Button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
