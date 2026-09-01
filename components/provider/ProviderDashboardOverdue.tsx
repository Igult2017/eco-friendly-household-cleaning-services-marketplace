import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"

type Booking = {
  id: string
  scheduledAt: Date | string | null
  scheduledEndAt: Date | string | null
  overdueSince: Date | string | null
  providerPayout: number
  customer: { firstName: string | null; lastName: string | null } | null
  service: { name: string } | null
}

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

// Same definition as lib/inngest/functions/overdue.ts: days since the work window (scheduled end, or
// 2h after start when none is set) passed — using the real overdueSince timestamp once the 6-hourly
// sweep has stamped it, falling back to a live calc for a job that just tipped overdue.
function daysOverdue(b: Booking): number {
  const since = b.overdueSince
    ? new Date(b.overdueSince).getTime()
    : (b.scheduledEndAt ? new Date(b.scheduledEndAt).getTime() : new Date(b.scheduledAt!).getTime() + 2 * HOUR_MS)
  return Math.max(1, Math.floor((Date.now() - since) / DAY_MS))
}

export async function ProviderDashboardOverdue({ bookings }: { bookings: Booking[] }) {
  const t = await getTranslations("compProviderProviderDashboardOverdue")
  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <AlertTriangle size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
        <p className="text-sm text-[#6B7280]">{t("emptyDescription")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-red-100 bg-red-50/50 flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600" /> {t("heading")}
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
              className="flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-red-50/40"
            >
              <div className="min-w-0">
                <p className="font-medium text-[#2B3441] text-sm">{b.service?.name ?? t("defaultService")}</p>
                <p className="text-xs text-[#6B7280]">{t("forCustomer", { name })}</p>
                {b.scheduledAt && <p className="text-xs text-[#9CA3AF] mt-0.5">{t("wasScheduledFor", { date: formatDate(b.scheduledAt) })}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Badge className="text-xs bg-red-100 text-red-700">{t("overdueByDays", { days: daysOverdue(b) })}</Badge>
                <p className="text-sm font-bold text-[#2D7A5F]">{formatCurrency(b.providerPayout)}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
