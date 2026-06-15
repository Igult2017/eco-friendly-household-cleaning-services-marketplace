"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

export interface RecurringData {
  frequency: "weekly" | "biweekly" | "monthly"
  dayOfWeek: number
  preferredTime: string
}

interface Props {
  onRecurringChange: (data: RecurringData | null) => void
}

const DAYS = [
  { labelKey: "daySunday", value: 0 },
  { labelKey: "dayMonday", value: 1 },
  { labelKey: "dayTuesday", value: 2 },
  { labelKey: "dayWednesday", value: 3 },
  { labelKey: "dayThursday", value: 4 },
  { labelKey: "dayFriday", value: 5 },
  { labelKey: "daySaturday", value: 6 },
] as const

export function RecurringToggle({ onRecurringChange }: Props) {
  const t = useTranslations("compBookingRecurringToggle")
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState<RecurringData["frequency"]>("weekly")
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [preferredTime, setPreferredTime] = useState("09:00")

  function handleToggle(checked: boolean) {
    setEnabled(checked)
    if (!checked) {
      onRecurringChange(null)
    } else {
      onRecurringChange({ frequency, dayOfWeek, preferredTime })
    }
  }

  function notify(
    nextFrequency: RecurringData["frequency"],
    nextDay: number,
    nextTime: string,
  ) {
    if (enabled) {
      onRecurringChange({ frequency: nextFrequency, dayOfWeek: nextDay, preferredTime: nextTime })
    }
  }

  function handleFrequencyChange(value: RecurringData["frequency"]) {
    setFrequency(value)
    notify(value, dayOfWeek, preferredTime)
  }

  function handleDayChange(value: number) {
    setDayOfWeek(value)
    notify(frequency, value, preferredTime)
  }

  function handleTimeChange(value: string) {
    setPreferredTime(value)
    notify(frequency, dayOfWeek, value)
  }

  return (
    <div className="rounded-2xl border border-[#E5EBF0] bg-white p-4">
      {/* Toggle row */}
      <label className="flex items-center justify-between cursor-pointer gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2B3441]">{t("makeRecurring")}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">{t("automateSessions")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => handleToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/40 ${
            enabled ? "bg-[#2D7A5F]" : "bg-[#D1D5DB]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </label>

      {/* Expanded options */}
      {enabled && (
        <div className="mt-5 space-y-4 border-t border-[#E5EBF0] pt-5">
          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-[#2B3441] mb-1.5">{t("frequency")}</label>
            <select
              value={frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as RecurringData["frequency"])}
              className="w-full rounded-xl border border-[#E5EBF0] bg-white px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
            >
              <option value="weekly">{t("frequencyWeekly")}</option>
              <option value="biweekly">{t("frequencyBiweekly")}</option>
              <option value="monthly">{t("frequencyMonthly")}</option>
            </select>
          </div>

          {/* Day of week */}
          <div>
            <label className="block text-sm font-medium text-[#2B3441] mb-1.5">{t("dayOfWeek")}</label>
            <select
              value={dayOfWeek}
              onChange={(e) => handleDayChange(Number(e.target.value))}
              className="w-full rounded-xl border border-[#E5EBF0] bg-white px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>{t(d.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Preferred time */}
          <div>
            <label className="block text-sm font-medium text-[#2B3441] mb-1.5">{t("preferredTime")}</label>
            <input
              type="time"
              value={preferredTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full rounded-xl border border-[#E5EBF0] px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
            />
          </div>
        </div>
      )}
    </div>
  )
}
