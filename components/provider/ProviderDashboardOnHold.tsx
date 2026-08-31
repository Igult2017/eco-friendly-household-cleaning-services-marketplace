import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { PauseCircle, AlertCircle, Hourglass } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { cn } from "@/lib/utils"

type Booking = {
  id: string
  status: string
  scheduledAt: Date | string | null
  providerPayout: number
  pendingProposal: unknown
  customer: { firstName: string | null; lastName: string | null } | null
  service: { name: string } | null
}

// "On hold" isn't a real status — it's a disagreement blocking agreement on WHEN (an unanswered
// reschedule/rate proposal) or WHETHER (an open dispute) the job goes ahead. Same definition used
// by the "On Hold" tab on the provider bookings list.
export async function ProviderDashboardOnHold({ bookings }: { bookings: Booking[] }) {
  const t = await getTranslations("compProviderProviderDashboardOnHold")
  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <PauseCircle size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
        <p className="text-sm text-[#6B7280]">{t("emptyDescription")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <PauseCircle size={16} className="text-amber-600" /> {t("heading")}
        </h2>
        <Link href="/provider/bookings" className="text-xs text-[#2D7A5F] hover:underline">{t("viewAll")}</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {bookings.map((b) => {
          const isDisputed = b.status === "disputed"
          const name = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || t("defaultCustomer")
          return (
            <Link
              key={b.id}
              href={`/provider/bookings/${b.id}`}
              className="block px-5 py-4 transition-colors hover:bg-[#F4FAF6]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#2B3441] text-sm">{b.service?.name ?? t("defaultService")}</p>
                  <p className="text-xs text-[#6B7280]">{t("forCustomer", { name })}</p>
                  {b.scheduledAt && <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(b.scheduledAt)}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge className={cn("text-xs flex items-center gap-1", isDisputed ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700")}>
                    {isDisputed ? <AlertCircle size={11} /> : <Hourglass size={11} />}
                    {isDisputed ? t("disputed") : t("pendingProposal")}
                  </Badge>
                  <p className="text-sm font-bold text-[#2D7A5F]">{formatCurrency(b.providerPayout)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
