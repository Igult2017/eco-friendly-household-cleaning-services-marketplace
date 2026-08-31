import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"

type Booking = {
  id: string
  scheduledAt: Date | string | null
  providerPayout: number
  customer: { firstName: string | null; lastName: string | null } | null
  service: { name: string } | null
}

export async function ProviderDashboardCompleted({ bookings }: { bookings: Booking[] }) {
  const t = await getTranslations("compProviderProviderDashboardCompleted")
  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <CheckCircle2 size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
        <p className="text-sm text-[#6B7280]">{t("emptyDescription")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#2D7A5F]" /> {t("heading")}
        </h2>
        <Link href="/provider/bookings" className="text-xs text-[#2D7A5F] hover:underline">{t("viewAll")}</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {bookings.map((b) => {
          const name = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || t("defaultCustomer")
          return (
            <Link
              key={b.id}
              href={`/provider/bookings/${b.id}`}
              className="flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#F4FAF6]"
            >
              <div className="min-w-0">
                <p className="font-medium text-[#2B3441] text-sm">{b.service?.name ?? t("defaultService")}</p>
                <p className="text-xs text-[#6B7280]">{t("forCustomer", { name })}</p>
                {b.scheduledAt && <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(b.scheduledAt)}</p>}
              </div>
              <p className="text-sm font-bold text-[#2D7A5F] flex-shrink-0">{formatCurrency(b.providerPayout)}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
