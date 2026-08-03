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
import { FieldError } from "@/components/ui/FieldError"

// Fallback only — used when no service has resolved yet (or the provider has no services and no
// per-service min/max exists to derive from). Real options are generated from the resolved service's
// minDurationMinutes/maxDurationMinutes below, so a cleaner who allows longer jobs (e.g. office
// cleaning) isn't artificially capped at a number that was never a real constraint.
const DEFAULT_MIN_DURATION = 60
const DEFAULT_MAX_DURATION = 480 // 8h

const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

function getNextNDays(n: number): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 1; i <= n; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d.toISOString().split("T")[0])
  }
  return days
}

// One button per full hour between the service's real min/max — rounds the min UP and the max DOWN
// to the nearest hour so every offered option is genuinely bookable (never below the provider's
// stated minimum, never above their stated maximum).
function buildDurationOptions(minMinutes: number, maxMinutes: number): { value: number; hours: number }[] {
  const startHour = Math.max(1, Math.ceil(minMinutes / 60))
  const endHour = Math.max(startHour, Math.floor(maxMinutes / 60))
  const options: { value: number; hours: number }[] = []
  for (let h = startHour; h <= endHour; h++) options.push({ value: h * 60, hours: h })
  return options
}

export default function BookStep3Page() {
  const t = useTranslations("customerBookSchedulePage")
  const router = useRouter()
  // frequency/recurringDays are read-only here now — they're SET on step 1 (the wizard's first
  // decision), this step just uses the picked weekday to filter which dates make sense to show.
  const { selectedProviderId, categoryId, setSchedule, scheduledAt, scheduledDateStr, scheduledTimeStr, durationMinutes, frequency, recurringDays } = useBookingStore()

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
  const [durationBounds, setDurationBounds] = useState({ min: DEFAULT_MIN_DURATION, max: DEFAULT_MAX_DURATION })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!selectedProviderId) { router.replace("/book"); return }
  }, [selectedProviderId, router])

  // Duration options come from the actual resolved service's min/max — not an arbitrary fixed list
  // (the previous hardcoded 1–6h options had no relationship to what any given cleaner actually
  // offers, and silently capped out anyone who genuinely needed e.g. 8 hours for a big job).
  useEffect(() => {
    if (!selectedProviderId) return
    fetch(`/api/providers/${selectedProviderId}/services${categoryId ? `?categorySlug=${categoryId}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const service = d?.services?.[0]
        const min = service?.minDurationMinutes ?? DEFAULT_MIN_DURATION
        const max = Math.max(min, service?.maxDurationMinutes ?? DEFAULT_MAX_DURATION)
        setDurationBounds({ min, max })
        // A duration picked before this resolved (or restored from a previous session) might now
        // fall outside this service's real range — snap it to the nearest hour actually offered
        // (buildDurationOptions only ever renders whole-hour buttons), not just the raw min/max.
        const startHour = Math.max(1, Math.ceil(min / 60))
        const endHour = Math.max(startHour, Math.floor(max / 60))
        setSelectedDuration((prev) => Math.min(Math.max(Math.round(prev / 60), startHour), endHour) * 60)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderId, categoryId])

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
    if (!selectedDate) { setFieldErrors({ date: t("errorSelectDate") }); return }
    if (!selectedTime || availability?.available === false) { setFieldErrors({ time: t("errorSelectTime") }); return }
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
  // every day of a plain 14-day window (most of which could never be chosen) was pure noise. Picking a
  // date here only sets up the FIRST (immediately paid) booking; each other selected weekday gets its
  // own independent recurring schedule starting from its own next natural occurrence — see
  // maybeSetupRecurringSchedule in book/confirm/page.tsx. A 14-day window filtered to 1-2 specific
  // weekdays only ever yields 1-2 selectable dates — too few real choices for picking a first cleaning
  // date — so widen the window to 60 days whenever day-filtering actually applies (a plain one-time
  // booking still only needs the next 14 days).
  const isDayFiltered = frequency !== "one_time" && recurringDays.length > 0
  const days = getNextNDays(isDayFiltered ? 60 : 14).filter((d) => !isDayFiltered || recurringDays.includes(new Date(d).getDay()))
  const durationOptions = buildDurationOptions(durationBounds.min, durationBounds.max)
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

        <div
          className={cn(
            "bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4",
            fieldErrors.date && "ring-1 ring-red-400"
          )}
        >
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
                  onClick={() => { setSelectedDate(d); setSelectedTime(null); setFieldErrors({}) }}
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
          <FieldError msg={fieldErrors.date} />
        </div>

        {selectedDate && (
          <div
            className={cn(
              "bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4",
              fieldErrors.time && "ring-1 ring-red-400"
            )}
          >
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
                      onClick={() => { if (!isBooked) { setSelectedTime(slot); setFieldErrors({}) } }}
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
            <FieldError msg={fieldErrors.time} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <Label className="text-sm font-semibold text-[#2B3441] mb-3 block">{t("durationLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((opt) => (
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
            className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white"
          >
            {t("continue")}
          </Button>
        </div>
      </div>
    </div>
  )
}
