"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Zap } from "lucide-react"
import { toast } from "sonner"

interface Props {
  initialValue: boolean
}

// Opt-in "I'm free right now" signal for Take Job (emergency) eligibility — deliberately separate
// from the weekly availability schedule, which only reflects FUTURE booked slots. Defaults off; a
// provider must deliberately flip this on to be eligible for instant-claim broadcasts.
export function InstantJobsToggle({ initialValue }: Props) {
  const t = useTranslations("providerProviderDashboardPage")
  const [enabled, setEnabled] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    setEnabled(next) // optimistic
    setSaving(true)
    try {
      const res = await fetch("/api/providers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instantJobsAvailable: next }),
      })
      if (!res.ok) throw new Error("failed")
    } catch {
      setEnabled(!next) // revert
      toast.error(t("instantJobsToggleError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm transition-colors ${enabled ? "bg-red-50 border-red-200" : "bg-white border-[#E5EBF0]"}`}>
      <div className="flex items-center gap-3">
        <Zap size={18} className={enabled ? "text-red-600" : "text-[#9CA3AF]"} />
        <div>
          <p className="text-sm font-semibold text-[#2B3441]">{t("instantJobsToggleTitle")}</p>
          <p className="text-xs text-[#6B7280]">{t("instantJobsToggleHint")}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t("instantJobsToggleTitle")}
        onClick={toggle}
        disabled={saving}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-red-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  )
}
