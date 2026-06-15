"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, X, CalendarClock } from "lucide-react"

interface RescheduleModalProps {
  bookingId: string
  currentScheduledAt: string
  isOpen: boolean
  onClose: () => void
}

export function RescheduleModal({ bookingId, currentScheduledAt, isOpen, onClose }: RescheduleModalProps) {
  const router = useRouter()
  const t = useTranslations("compBookingRescheduleModal")
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [durationHours, setDurationHours] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newTime) { setError(t("errorSelectDateTime")); return }
    setError(null)
    setSubmitting(true)

    const newScheduledAt = new Date(`${newDate}T${newTime}:00`).toISOString()
    const end = new Date(`${newDate}T${newTime}:00`)
    end.setHours(end.getHours() + durationHours)
    const newScheduledEndAt = end.toISOString()

    try {
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newScheduledAt, newScheduledEndAt }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("errorRescheduleFailed")); return }
      onClose()
      router.refresh()
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setSubmitting(false)
    }
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split("T")[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#2B3441] transition-colors"
          aria-label={t("closeAriaLabel")}
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <CalendarClock size={22} className="text-[#2D7A5F]" />
          <h2 className="font-serif text-xl font-bold text-[#2B3441]">{t("title")}</h2>
        </div>

        <p className="text-sm text-[#6B7280] mb-5">
          {t("currentScheduleLabel")} <span className="font-medium text-[#2B3441]">{new Date(currentScheduledAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2B3441] mb-1">{t("newDateLabel")}</label>
            <input
              type="date"
              value={newDate}
              min={minDateStr}
              onChange={(e) => setNewDate(e.target.value)}
              required
              className="w-full rounded-xl border border-[#E5EBF0] px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2B3441] mb-1">{t("newTimeLabel")}</label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              required
              className="w-full rounded-xl border border-[#E5EBF0] px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2B3441] mb-1">{t("durationLabel")}</label>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full rounded-xl border border-[#E5EBF0] px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30 bg-white"
            >
              <option value={1}>{t("durationOption", { count: 1 })}</option>
              <option value={2}>{t("durationOption", { count: 2 })}</option>
              <option value={3}>{t("durationOption", { count: 3 })}</option>
              <option value={4}>{t("durationOption", { count: 4 })}</option>
              <option value={5}>{t("durationOption", { count: 5 })}</option>
              <option value={6}>{t("durationOption", { count: 6 })}</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[#E5EBF0] text-sm font-medium text-[#6B7280] hover:bg-[#F9FAFB] py-2.5 transition-colors"
            >
              {t("cancelButton")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={15} className="animate-spin" />{t("submitting")}</> : t("submitButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
