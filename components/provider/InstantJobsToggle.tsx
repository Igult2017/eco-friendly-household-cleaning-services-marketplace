"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Zap } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

interface Props {
  initialValue: boolean
}

// Opt-in "I'm free right now" signal for Take Job (emergency) eligibility — deliberately separate
// from the weekly availability schedule, which only reflects FUTURE booked slots. Defaults off; a
// provider must deliberately flip this on to be eligible for instant-claim broadcasts.
//
// The ON/OFF state used to be shown only through colour (red vs grey) and which side the switch's
// dot sat on, with the heading and hint text staying identical either way — a cleaner glancing at
// this card had no WORD confirming whether they were currently opted in. Now the hint line itself
// states the current state, plus a small ON/OFF tag next to the heading for an at-a-glance check
// that doesn't rely on colour alone.
export function InstantJobsToggle({ initialValue }: Props) {
  const t = useTranslations("providerProviderDashboardPage")
  const [enabled, setEnabled] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function toggle(next: boolean) {
    setEnabled(next) // optimistic
    setSaving(true)
    try {
      const res = await fetch("/api/providers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instantJobsAvailable: next }),
      })
      if (!res.ok) throw new Error("failed")
      toast.success(next ? t("instantJobsToggleSuccessOn") : t("instantJobsToggleSuccessOff"))
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#2B3441]">{t("instantJobsToggleTitle")}</p>
            <Badge className={enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
              {enabled ? t("instantJobsToggleOnBadge") : t("instantJobsToggleOffBadge")}
            </Badge>
          </div>
          <p className="text-xs text-[#6B7280]">
            {enabled ? t("instantJobsToggleHintOn") : t("instantJobsToggleHintOff")}
          </p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={toggle}
        disabled={saving}
        aria-label={t("instantJobsToggleTitle")}
        className="data-checked:bg-red-600"
      />
    </div>
  )
}
