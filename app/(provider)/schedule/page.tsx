"use client"

import { useState, useEffect } from "react"
import { Loader2, Check, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { BackButton } from "@/components/ui/BackButton"

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

type Slot = { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }

export default function ProviderSchedulePage() {
  const t = useTranslations("providerSchedulePage")
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [blackoutDate, setBlackoutDate] = useState("")
  const [addingBlackout, setAddingBlackout] = useState(false)
  const [blackouts, setBlackouts] = useState<{ id: string; date: string; reason: string | null }[]>([])

  const reload = () => {
    setLoading(true)
    fetch("/api/provider/availability")
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.availability ?? [])
        setBlackouts(d.blackouts ?? [])
        setLoading(false)
      })
  }

  useEffect(() => { reload() }, [])

  const getSlot = (day: number): Slot =>
    slots.find((s) => s.dayOfWeek === day) ?? { dayOfWeek: day, startTime: "09:00", endTime: "18:00", isActive: false }

  const save = async (slot: Slot) => {
    setSaving(slot.dayOfWeek)
    await fetch("/api/provider/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "availability", data: slot }),
    })
    setSaving(null)
    reload()
  }

  const addBlackout = async () => {
    if (!blackoutDate) return
    setAddingBlackout(true)
    await fetch("/api/provider/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "blackout", data: { date: blackoutDate } }),
    })
    setBlackoutDate("")
    setAddingBlackout(false)
    reload()
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="mb-1"><BackButton fallback="/provider/dashboard" /></div>
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("title")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subtitle")}</p>
      </div>

      {/* Weekly Availability */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2B3441]">{t("weeklyAvailabilityHeading")}</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#2D7A5F]" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {DAY_KEYS.map((dayKey, dayIdx) => {
              const slot = getSlot(dayIdx)
              return (
                <div key={dayIdx} className="flex items-center gap-4 px-6 py-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none w-28">
                    <input
                      type="checkbox"
                      checked={slot.isActive}
                      onChange={(e) => {
                        const updated = { ...slot, isActive: e.target.checked }
                        save(updated)
                      }}
                      className="h-4 w-4 accent-[#2D7A5F] cursor-pointer"
                    />
                    <span className={`text-sm font-medium ${slot.isActive ? "text-[#2B3441]" : "text-[#6B7280]"}`}>{t(dayKey)}</span>
                  </label>

                  {slot.isActive && (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => {
                          const updated = { ...slot, startTime: e.target.value }
                          setSlots((prev) => {
                            const existing = prev.findIndex((s) => s.dayOfWeek === dayIdx)
                            return existing >= 0 ? prev.map((s, i) => i === existing ? updated : s) : [...prev, updated]
                          })
                        }}
                        onBlur={(e) => save({ ...slot, startTime: e.target.value })}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
                      />
                      <span className="text-[#6B7280] text-sm">{t("timeRangeSeparator")}</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => {
                          const updated = { ...slot, endTime: e.target.value }
                          setSlots((prev) => {
                            const existing = prev.findIndex((s) => s.dayOfWeek === dayIdx)
                            return existing >= 0 ? prev.map((s, i) => i === existing ? updated : s) : [...prev, updated]
                          })
                        }}
                        onBlur={(e) => save({ ...slot, endTime: e.target.value })}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
                      />
                      {saving === dayIdx && <Loader2 className="h-4 w-4 animate-spin text-[#2D7A5F]" />}
                    </div>
                  )}

                  {!slot.isActive && (
                    <span className="text-sm text-[#6B7280]">{t("notAvailable")}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Blackout Dates */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2B3441]">{t("blockedDatesHeading")}</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">{t("blockedDatesDescription")}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="date"
              value={blackoutDate}
              onChange={(e) => setBlackoutDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
            />
            <button
              onClick={addBlackout}
              disabled={!blackoutDate || addingBlackout}
              className="flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#256349] transition-colors"
            >
              {addingBlackout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("blockDateButton")}
            </button>
          </div>

          {blackouts.length > 0 ? (
            <div className="space-y-2">
              {blackouts.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-sm font-medium text-[#2B3441]">{new Date(b.date).toLocaleDateString("de-DE")}</span>
                  {b.reason && <span className="text-xs text-[#6B7280]">— {b.reason}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center text-[#6B7280] py-4">{t("noBlockedDates")}</p>
          )}
        </div>
      </div>
    </div>
  )
}
