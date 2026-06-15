import Link from "next/link"
import { CalendarDays, Star } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"

type Booking = {
  id: string
  bookingNumber: string
  status: string
  scheduledAt: Date
  totalAmount: number
  provider: { businessName: string } | null
  service: { name: string } | null
}

export async function DashboardBookings({
  upcoming,
  past,
  reviewedBookingIds = [],
}: {
  upcoming: Booking[]
  past: Booking[]
  reviewedBookingIds?: string[]
}) {
  const t = await getTranslations("compCustomerDashboardBookings")

  const STATUS: Record<string, { label: string; color: string }> = {
    payment_authorized: { label: t("statusConfirmed"), color: "bg-blue-100 text-blue-700" },
    confirmed:          { label: t("statusConfirmed"), color: "bg-blue-100 text-blue-700" },
    in_progress:        { label: t("statusInProgress"), color: "bg-[#D1F0E0] text-[#2D7A5F]" },
    pending_capture:    { label: t("statusFinishingUp"), color: "bg-[#D1F0E0] text-[#2D7A5F]" },
    completed:          { label: t("statusCompleted"), color: "bg-green-100 text-green-700" },
    cancelled:          { label: t("statusCancelled"), color: "bg-red-100 text-red-700" },
    disputed:           { label: t("statusDisputed"), color: "bg-orange-100 text-orange-700" },
    refunded:           { label: t("statusRefunded"), color: "bg-gray-100 text-gray-600" },
  }

  const rows = [...upcoming, ...past].slice(0, 6)

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5EBF0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F4FAF6] px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-[#2B3441]">
          <CalendarDays size={16} className="text-[#2D7A5F]" /> {t("heading")}
        </h2>
        <Link href="/book" className="text-xs font-medium text-[#2D7A5F] hover:underline">
          {t("newBooking")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[#9CA3AF] mb-3">{t("emptyState")}</p>
          <Link href="/book" className="text-xs font-semibold text-[#2D7A5F] hover:underline">
            {t("bookFirst")}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(b => {
            const cfg = STATUS[b.status]
            return (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#F4FAF6]"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#2B3441]">
                    {b.service?.name ?? t("defaultService")} · {b.provider?.businessName ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">{formatDate(b.scheduledAt)}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-[#2B3441]">{formatCurrency(b.totalAmount)}</p>
                  {cfg && (
                    <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", cfg.color)}>
                      {cfg.label}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {(() => {
        const done = past.find(b => b.status === "completed" && !reviewedBookingIds.includes(b.id))
        return done ? (
          <div className="border-t border-[#F4FAF6] px-5 py-3">
            <Link
              href={`/bookings/${done.id}/review`}
              className="flex items-center gap-1 text-xs font-medium text-[#2D7A5F] hover:underline"
            >
              <Star size={11} /> {t("leaveReview", { provider: done.provider?.businessName ?? t("defaultCleaner") })}
            </Link>
          </div>
        ) : null
      })()}

    </div>
  )
}
