"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface RescheduleFormProps {
  bookingId: string
  currentScheduledAt: string
}

export function RescheduleForm({ bookingId, currentScheduledAt }: RescheduleFormProps) {
  const t = useTranslations("compBookingRescheduleForm")
  const router = useRouter()
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [durationHours, setDurationHours] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split("T")[0]

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
      setSuccess(true)
      router.refresh()
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center text-center py-8 gap-4">
        <CheckCircle2 size={48} className="text-[#2D7A5F]" />
        <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("successTitle")}</h2>
        <p className="text-[#6B7280]">{t("successMessage")}</p>
        <Link
          href={`/bookings/${bookingId}`}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold px-6 py-3 transition-colors"
        >
          {t("viewBooking")}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-[#F4FAF6] rounded-xl px-4 py-3 text-sm text-[#6B7280]">
        {t("currentSchedule")}{" "}
        <span className="font-medium text-[#2B3441]">
          {new Date(currentScheduledAt).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2B3441] mb-1.5">{t("newDate")}</label>
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
        <label className="block text-sm font-medium text-[#2B3441] mb-1.5">{t("newTime")}</label>
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          required
          className="w-full rounded-xl border border-[#E5EBF0] px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2B3441] mb-1.5">{t("duration")}</label>
        <select
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
          className="w-full rounded-xl border border-[#E5EBF0] px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30 bg-white"
        >
          <option value={1}>{t("durationHours", { count: 1 })}</option>
          <option value={2}>{t("durationHours", { count: 2 })}</option>
          <option value={3}>{t("durationHours", { count: 3 })}</option>
          <option value={4}>{t("durationHours", { count: 4 })}</option>
          <option value={5}>{t("durationHours", { count: 5 })}</option>
          <option value={6}>{t("durationHours", { count: 6 })}</option>
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Link
          href={`/bookings/${bookingId}`}
          className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#E5EBF0] text-sm font-medium text-[#6B7280] hover:bg-[#F9FAFB] py-3 transition-colors"
        >
          {t("goBack")}
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold py-3 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? <><Loader2 size={15} className="animate-spin" />{t("rescheduling")}</> : t("confirmReschedule")}
        </button>
      </div>
    </form>
  )
}
