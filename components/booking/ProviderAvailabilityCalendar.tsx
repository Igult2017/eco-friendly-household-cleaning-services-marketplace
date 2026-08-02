"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"

type DayStatus = "available" | "booked" | "day_off" | "blackout"
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
const MAX_FORWARD_MONTHS = 3

const STATUS_DOT: Record<DayStatus, string> = {
  available: "bg-[#2D7A5F]",
  booked: "bg-amber-500",
  day_off: "bg-[#D1D5DB]",
  blackout: "bg-[#D1D5DB]",
}

interface Props {
  providerId: string
  selectedDate?: string | null
  // Omit for read-only mode (public profile page). Pass to make free days clickable (wizard).
  onSelectDate?: (date: string) => void
}

// Month-at-a-glance free/busy view — "is this cleaner free or booked, and on which dates."
// Distinct from the single-date /api/providers/[id]/availability route used at the moment of
// picking a time slot; this one answers the broader question before a date is even chosen.
export function ProviderAvailabilityCalendar({ providerId, selectedDate, onSelectDate }: Props) {
  const t = useTranslations("compProviderAvailabilityCalendar")
  const tCal = useTranslations("providerCalendarPage")
  const locale = useLocale()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [days, setDays] = useState<Record<string, DayStatus>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const last = new Date(cursor.y, cursor.m + 1, 0)
    const from = first < today ? today : first
    const fromStr = from.toISOString().split("T")[0]
    const toStr = last.toISOString().split("T")[0]
    setLoading(true)
    fetch(`/api/providers/${providerId}/availability-range?from=${fromStr}&to=${toStr}`)
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d) => {
        const map: Record<string, DayStatus> = {}
        for (const day of d.days ?? []) map[day.date] = day.status
        setDays(map)
      })
      .catch(() => setDays({}))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, cursor.y, cursor.m])

  const first = new Date(cursor.y, cursor.m, 1)
  const startWeekday = (first.getDay() + 6) % 7 // Monday-first grid
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const monthLabel = first.toLocaleDateString(locale, { month: "long", year: "numeric" })
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const isAtCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth()
  const maxCursor = new Date(today.getFullYear(), today.getMonth() + MAX_FORWARD_MONTHS, 1)
  const isAtMaxMonth = cursor.y === maxCursor.getFullYear() && cursor.m === maxCursor.getMonth()
  const move = (delta: number) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const dateStrFor = (day: number) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const statusLabel = (s: DayStatus | undefined) => (s === "available" ? t("legendFree") : s === "booked" ? t("legendBooked") : t("legendUnavailable"))

  return (
    <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F4F8]">
        <h3 className="font-semibold text-[#2B3441] text-sm capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => move(-1)} disabled={isAtCurrentMonth} aria-label={tCal("prevMonth")} className="p-1.5 rounded-lg hover:bg-[#F4FAF6] text-[#6B7280] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => move(1)} disabled={isAtMaxMonth} aria-label={tCal("nextMonth")} className="p-1.5 rounded-lg hover:bg-[#F4FAF6] text-[#6B7280] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[#F0F4F8] bg-[#FAFCFB]">
        {WEEKDAY_KEYS.map((w) => <div key={w} className="py-1.5 text-center text-[10px] font-semibold uppercase text-[#9CA3AF]">{tCal(w)}</div>)}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-[#2D7A5F]" /></div>
      ) : (
        <div className="grid grid-cols-7 p-2 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />
            const dateStr = dateStrFor(day)
            const isPast = new Date(cursor.y, cursor.m, day) < today
            const status = days[dateStr]
            const clickable = !!onSelectDate && !isPast && status === "available"
            const isSelected = selectedDate === dateStr
            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelectDate?.(dateStr)}
                title={isPast ? undefined : statusLabel(status)}
                aria-label={isPast ? undefined : `${dateStr}: ${statusLabel(status)}`}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-xs transition-colors
                  ${isPast ? "text-[#D1D5DB]" : "text-[#2B3441]"}
                  ${isSelected ? "bg-[#2D7A5F] text-white" : clickable ? "hover:bg-[#F4FAF6] cursor-pointer" : "cursor-default"}`}
              >
                <span>{day}</span>
                {!isPast && status && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : STATUS_DOT[status]}`} />
                )}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-[#F0F4F8] text-[11px] text-[#6B7280]">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#2D7A5F]" />{t("legendFree")}</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t("legendBooked")}</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#D1D5DB]" />{t("legendUnavailable")}</span>
      </div>
    </div>
  )
}
