"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, CalendarDays, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Props {
  scheduleId: string
  businessName: string
  serviceName: string
  frequency: string
  nextBookingAt: string | null
  status: string
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-[#D1F0E0] text-[#2D7A5F]",
  paused: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
}

const FREQUENCY_KEY: Record<string, string> = {
  weekly: "frequencyWeekly",
  biweekly: "frequencyBiweekly",
  monthly: "frequencyMonthly",
}

const STATUS_KEY: Record<string, string> = {
  active: "statusActive",
  paused: "statusPaused",
  cancelled: "statusCancelled",
}

export function RecurringScheduleCard({
  scheduleId,
  businessName,
  serviceName,
  frequency,
  nextBookingAt,
  status,
}: Props) {
  const router = useRouter()
  const t = useTranslations("compBookingRecurringScheduleCard")
  const [loading, setLoading] = useState<"pause" | "cancel" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(newStatus: "paused" | "cancelled") {
    setError(null)
    setLoading(newStatus === "paused" ? "pause" : "cancel")
    try {
      const res = await fetch(`/api/recurring/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t("errorActionFailed"))
        return
      }
      router.refresh()
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setLoading(null)
    }
  }

  const badgeClass = STATUS_BADGE[status] ?? STATUS_BADGE.active
  const frequencyLabel = FREQUENCY_KEY[frequency]
    ? t(FREQUENCY_KEY[frequency])
    : frequency
  const statusLabel = STATUS_KEY[status] ? t(STATUS_KEY[status]) : status

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#2B3441] text-base">{serviceName}</p>
          <p className="text-sm text-[#6B7280] mt-0.5">{t("withBusiness", { businessName })}</p>
        </div>
        <Badge className={`text-xs px-2.5 py-1 capitalize ${badgeClass}`}>
          {statusLabel}
        </Badge>
      </div>

      {/* Schedule details */}
      <div className="flex flex-wrap gap-4 text-sm text-[#6B7280]">
        <span className="flex items-center gap-1.5">
          <RefreshCw size={13} className="text-[#2D7A5F]" />
          {frequencyLabel}
        </span>
        {nextBookingAt && (
          <span className="flex items-center gap-1.5">
            <CalendarDays size={13} className="text-[#2D7A5F]" />
            {t("nextLabel")}{" "}
            {new Date(nextBookingAt).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-red-500 text-xs">{error}</p>}

      {/* Actions — only show when not cancelled */}
      {status !== "cancelled" && (
        <div className="flex gap-2 pt-1">
          {status === "active" && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => updateStatus("paused")}
              className="flex-1 rounded-xl border border-[#E5EBF0] text-sm font-medium text-[#6B7280] hover:bg-[#F9FAFB] py-2.5 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {loading === "pause" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {t("pauseButton")}
            </button>
          )}
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => updateStatus("cancelled")}
            className="flex-1 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 py-2.5 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {loading === "cancel" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {t("cancelButton")}
          </button>
        </div>
      )}
    </div>
  )
}
