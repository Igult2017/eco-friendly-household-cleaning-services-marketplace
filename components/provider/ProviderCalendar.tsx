"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"

type Ev = { id: string; date: string; label: string; time: string; status: string }

const STATUS_CLS: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  payment_authorized: "bg-amber-100 text-amber-700",
  pending_capture: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-50 text-red-500 line-through",
  disputed: "bg-red-100 text-red-700",
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export function ProviderCalendar({ events }: { events: Ev[] }) {
  const t = useTranslations("providerCalendarPage")
  const locale = useLocale()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const first = new Date(cursor.y, cursor.m, 1)
  const startWeekday = (first.getDay() + 6) % 7 // Monday-first grid
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const monthLabel = first.toLocaleDateString(locale, { month: "long", year: "numeric" })

  const byDay: Record<number, Ev[]> = {}
  for (const e of events) {
    const d = new Date(e.date)
    if (d.getFullYear() === cursor.y && d.getMonth() === cursor.m) (byDay[d.getDate()] ??= []).push(e)
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const now = new Date()
  const isToday = (day: number) =>
    now.getFullYear() === cursor.y && now.getMonth() === cursor.m && now.getDate() === day

  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  return (
    <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F4F8]">
        <h2 className="font-semibold text-[#2B3441] capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} aria-label={t("prevMonth")} className="p-2 rounded-lg hover:bg-[#F4FAF6] text-[#6B7280]"><ChevronLeft size={18} /></button>
          <button onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })} className="px-3 py-1.5 rounded-lg hover:bg-[#F4FAF6] text-xs font-medium text-[#2D7A5F]">{t("today")}</button>
          <button onClick={() => move(1)} aria-label={t("nextMonth")} className="p-2 rounded-lg hover:bg-[#F4FAF6] text-[#6B7280]"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[#F0F4F8] bg-[#FAFCFB]">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-[11px] font-semibold uppercase text-[#9CA3AF]">{t(w)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <div key={i} className={`min-h-[92px] border-b border-r border-[#F0F4F8] p-1.5 ${day === null ? "bg-[#FAFCFB]" : ""}`}>
            {day !== null && (
              <>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(day) ? "bg-[#2D7A5F] text-white font-bold" : "text-[#6B7280]"}`}>{day}</span>
                <div className="mt-1 space-y-1">
                  {(byDay[day] ?? []).map((e) => (
                    <Link key={e.id} href="/provider/bookings" title={`${e.time} · ${e.label}`} className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLS[e.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {e.time} {e.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
