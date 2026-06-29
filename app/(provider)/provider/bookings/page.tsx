"use client"

import { useState, useEffect } from "react"
import { Loader2, CalendarClock, MapPin, FileText } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { formatCurrency } from "@/lib/utils/formatCurrency"

type Booking = {
  id: string
  bookingNumber: string
  status: string
  scheduledAt: string
  scheduledEndAt: string | null
  serviceAddress: { line1: string; city: string; postalCode: string; country: string }
  specialInstructions: string | null
  subtotalAmount: number
  providerPayout: number
  carbonOffsetAmount: number
  serviceName: string | null
  customerName: string | null
  customerEmail: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, { labelKey: string; color: string }> = {
  payment_authorized: { labelKey: "statusConfirmed", color: "bg-blue-100 text-blue-700" },
  confirmed:          { labelKey: "statusConfirmed", color: "bg-blue-100 text-blue-700" },
  in_progress:        { labelKey: "statusInProgress", color: "bg-amber-100 text-amber-700" },
  completed:          { labelKey: "statusCompleted", color: "bg-green-100 text-green-700" },
  cancelled:          { labelKey: "statusCancelled", color: "bg-gray-100 text-gray-500" },
  disputed:           { labelKey: "statusDisputed", color: "bg-red-100 text-red-700" },
  refunded:           { labelKey: "statusRefunded", color: "bg-purple-100 text-purple-700" },
}

const TABS = ["all", "payment_authorized", "in_progress", "completed", "cancelled"]

export default function ProviderBookingsPage() {
  const t = useTranslations("providerProviderBookingsPage")
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")

  useEffect(() => {
    fetch("/api/provider/bookings")
      .then((r) => r.json())
      .then((d) => { setBookings(d.bookings ?? []); setLoading(false) })
  }, [])

  const visible = tab === "all" ? bookings : bookings.filter((b) => b.status === tab)

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("title")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subtitle")}</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === tabKey ? "bg-[#2D7A5F] text-white" : "bg-white text-[#6B7280] border border-gray-200 hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
            }`}
          >
            {tabKey === "all" ? t("tabAll") : STATUS_LABEL[tabKey]?.labelKey ? t(STATUS_LABEL[tabKey].labelKey) : tabKey}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm py-20 text-center">
          <p className="text-[#6B7280] text-sm">{t("emptyState")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((b) => {
            const statusMeta = STATUS_LABEL[b.status]
            const badge = { label: statusMeta ? t(statusMeta.labelKey) : b.status, color: statusMeta?.color ?? "bg-gray-100 text-gray-600" }
            const scheduledDate = new Date(b.scheduledAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
            const scheduledTime = new Date(b.scheduledAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })

            return (
              <div key={b.id} className="rounded-2xl bg-white shadow-sm border border-[#E5EBF0] p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#2B3441]">{b.bookingNumber}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                    </div>
                    <p className="text-sm font-medium text-[#2B3441]">{b.serviceName ?? t("defaultServiceName")}</p>
                    <p className="text-xs text-[#6B7280]">{t("customerLabel", { name: b.customerName ?? b.customerEmail ?? "—" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#2D7A5F]">{formatCurrency(b.providerPayout)}</p>
                    <p className="text-xs text-[#9CA3AF]">{t("yourPayout")}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#6B7280]">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-[#2D7A5F]" />
                    <span>{t("scheduledAt", { date: scheduledDate, time: scheduledTime })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#2D7A5F]" />
                    <span>{b.serviceAddress.line1}, {b.serviceAddress.city}</span>
                  </div>
                </div>

                {b.specialInstructions && (
                  <p className="mt-2 text-xs text-[#6B7280] bg-[#F4FAF6] rounded-lg px-3 py-2">
                    {b.specialInstructions}
                  </p>
                )}

                {(b.status === "payment_authorized" || b.status === "confirmed" || b.status === "in_progress") && (
                  <div className="mt-3 pt-3 border-t border-[#E5EBF0]">
                    <Link
                      href={`/bookings/${b.id}/complete`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
                    >
                      {t("markAsComplete")}
                    </Link>
                  </div>
                )}
                {b.status === "completed" && (
                  <div className="mt-3 pt-3 border-t border-[#E5EBF0]">
                    <Link
                      href={`/provider/bookings/${b.id}/receipt`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2D7A5F] hover:underline"
                    >
                      <FileText className="h-4 w-4" /> {t("receiptLink")}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
