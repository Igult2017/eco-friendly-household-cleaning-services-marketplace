"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { zonedTimeToUtc } from "@/lib/utils/tz"
import { BackButton } from "@/components/ui/BackButton"
import { ProviderAvailabilityCalendar } from "@/components/booking/ProviderAvailabilityCalendar"
import { CalendarDays } from "lucide-react"

const DURATION_OPTIONS = [
  { value: 60, hours: 1 },
  { value: 120, hours: 2 },
  { value: 180, hours: 3 },
  { value: 240, hours: 4 },
  { value: 360, hours: 6 },
]

const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

function getNext14Days(): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d.toISOString().split("T")[0])
  }
  return days
}

export default function BookStep3Page() {
  const t = useTranslations("customerBookSchedulePage")
  const router = useRouter()
  // frequency/recurringDays are read-only here now — they're SET on step 1 (the wizard's first
  // decision), this step just uses the picked weekday to filter which dates make sense to show.
  const { selectedProviderId, setSchedule, scheduledAt, scheduledDateStr, scheduledTimeStr, durationMinutes, frequency, recurringDays } = useBookingStore()

  // scheduledAt is now an ISO string; convert back to local date/time parts for display
  const restoreDate = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const restoreTime = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  // Prefer the raw picked parts (cleaner's tz); decoding the UTC instant in the browser's tz is only
  // the legacy fallback and shifts times for cross-timezone clients.
  const [selectedDate, setSelectedDate] = useState<string | null>(scheduledDateStr ?? restoreDate(scheduledAt))
  const [selectedTime, setSelectedTime] = useState<string | null>(scheduledTimeStr ?? restoreTime(scheduledAt))
  const [selectedDuration, setSelectedDuration] = useState(durationMinutes)
  const [availability, setAvailability] = useState<{ available: boolean; timezone?: string; workingHours?: { start: string; end: string }; bookedSlots?: { start: string; end: string | null }[] } | null>(null)
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    if (!selectedProviderId) { router.replace("/book"); return }
  }, [selectedProviderId, router])

  useEffect(() => {
    if (!selectedDate || !selectedProviderId) return
    setLoadingAvail(true)
    fetch(`/api/providers/${selectedProviderId}/availability?date=${selectedDate}`)
      .then((r) => r.json())
      .then(setAvailability)
      .finally(() => setLoadingAvail(false))
  }, [selectedDate, selectedProviderId])

  function filterSlots(slots: string[]) {
    if (!availability?.workingHours) return slots
    const { start, end } = availability.workingHours
    return slots.filter((s) => s >= start.slice(0, 5) && s <= end.slice(0, 5))
  }

  function handleNext() {
    if (!selectedDate || !selectedTime) return
    // Interpret the picked time in the CLEANER's timezone (slots are shown in their working hours),
    // not the client's browser timezone — otherwise a cross-tz client books the wrong instant.
    const tz = availability?.timezone
    const dt = tz ? zonedTimeToUtc(selectedDate, selectedTime, tz) : new Date(`${selectedDate}T${selectedTime}:00`)
    // Persist the raw picked parts too — restoring them from the UTC instant via the BROWSER's tz
    // silently shifted the booking for cross-timezone clients on back-navigation.
    setSchedule(dt, selectedDuration, selectedDate, selectedTime)
    router.push("/book/extras")
  }

  // For a recurring booking with weekday(s) already picked in step 1, only offer dates that fall on
  // ONE of those weekdays — the recurring schedule(s) will run on those days every cycle, so showing
  // every day of the fortnight here (most of which could never be chosen) was pure noise. Picking a
  // date here only sets up the FIRST (immediately paid) booking; each other selected weekday gets its
  // own independent recurring schedule starting from its own next natural occurrence — see
  // maybeSetupRecurringSchedule in book/confirm/page.tsx.
  const days = getNext14Days().filter((d) => frequency === "one_time" || recurringDays.length === 0 || recurringDays.includes(new Date(d).getDay()))
  const availableSlots = filterSlots(TIME_SLOTS)

  // Grey out slots the cleaner is already booked for, so the client sees conflicts up front (not just
  // at checkout). Slot times are the cleaner's local time → convert to a UTC instant in their tz.
  const slotTz = availability?.timezone
  const bookedSet = new Set<string>()
  if (selectedDate && slotTz && availability?.bookedSlots?.length) {
    for (const slot of availableSlots) {
      const slotMs = zonedTimeToUtc(selectedDate, slot, slotTz).getTime()
      // Test the WHOLE requested window (start + chosen duration), not just the start instant — a long
      // booking that runs INTO an existing one otherwise looks free and only fails after payment.
      const slotEndMs = slotMs + selectedDuration * 60_000
      const taken = availability.bookedSlots.some((bs) => {
        const s = new Date(bs.start).getTime()
        const e = bs.end ? new Date(bs.end).getTime() : s + 60 * 60 * 1000
        return slotMs < e && slotEndMs > s
      })
      if (taken) bookedSet.add(slot)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={3} />
      <div className="mb-1"><BackButton fallback="/book/providers" /></div>

      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">
          {t("heading")}
        </h1>
        <p className="text-center text-[#6B7280] mb-8">{t("subheading")}</p>

        {/* Read-only "is this cleaner free or booked, and on which dates" view — the strip below
            stays the actual selection UI; this is broader context, so it's opt-in, not always on. */}
        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-[#2D7A5F] hover:underline mb-4"
        >
          <CalendarDays size={15} />
          {showCalendar ? t("hideFullCalendar") : t("viewFullCalendar")}
        </button>
        {showCalendar && selectedProviderId && (
          <div className="mb-4">
            <ProviderAvailabilityCalendar providerId={selectedProviderId} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
          <Label className="text-sm font-semibold text-[#2B3441] mb-3 block">{t("selectDateLabel")}</Label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {days.map((d) => {
              const date = new Date(d)
              const dayName = date.toLocaleDateString("en-GB", { weekday: "short" })
              const dayNum = date.getDate()
              const month = date.toLocaleDateString("en-GB", { month: "short" })
              return (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setSelectedTime(null) }}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl border-2 text-sm transition-all",
                    selectedDate === d
                      ? "border-[#2D7A5F] bg-[#2D7A5F] text-white"
                      : "border-[#E5EBF0] hover:border-[#4CB87A] text-[#2B3441]"
                  )}
                >
                  <span className="text-xs font-medium opacity-80">{dayName}</span>
                  <span className="text-lg font-bold leading-none">{dayNum}</span>
                  <span className="text-xs opacity-70">{month}</span>
                </button>
              )
            })}
          </div>
        </div>

        {selectedDate && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
            <Label className="text-sm font-semibold text-[#2B3441] mb-3 flex items-center gap-2">
              <Clock size={15} /> {t("selectTimeLabel")}
              {loadingAvail && <Loader2 size={14} className="animate-spin text-[#2D7A5F]" />}
            </Label>
            {!availability?.available && !loadingAvail ? (
              <p className="text-sm text-[#9CA3AF] py-2">{t("notAvailable")}</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {(loadingAvail ? TIME_SLOTS : availableSlots).map((slot) => {
                  const isBooked = bookedSet.has(slot)
                  return (
                    <button
                      key={slot}
                      disabled={loadingAvail || isBooked}
                      onClick={() => !isBooked && setSelectedTime(slot)}
                      title={isBooked ? t("slotBooked") : undefined}
                      className={cn(
                        "py-2 rounded-lg text-sm font-medium border-2 transition-all",
                        isBooked
                          ? "border-[#E5EBF0] bg-gray-50 text-[#C0C6CE] line-through cursor-not-allowed"
                          : selectedTime === slot
                          ? "border-[#2D7A5F] bg-[#2D7A5F] text-white"
                          : "border-[#E5EBF0] hover:border-[#4CB87A] text-[#2B3441]",
                        loadingAvail && "opacity-40"
                      )}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <Label className="text-sm font-semibold text-[#2B3441] mb-3 block">{t("durationLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedDuration(opt.value)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all",
                  selectedDuration === opt.value
                    ? "border-[#2D7A5F] bg-[#2D7A5F] text-white"
                    : "border-[#E5EBF0] hover:border-[#4CB87A] text-[#2B3441]"
                )}
              >
                {t("durationOption", { hours: opt.hours })}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/book/providers")} className="flex-1 h-11 border-[#E5EBF0]">
            {t("back")}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedDate || !selectedTime || availability?.available === false}
            className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white"
          >
            {t("continue")}
          </Button>
        </div>
      </div>
    </div>
  )
}
