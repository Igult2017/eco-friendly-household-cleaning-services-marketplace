"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { Settings, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Config, FIELD_BOUNDS, NUMERIC_KEYS } from "@/components/admin/settings/shared"
import { MoneySection } from "@/components/admin/settings/MoneySection"
import { ReferralSection } from "@/components/admin/settings/ReferralSection"
import { OperationsSection } from "@/components/admin/settings/OperationsSection"
import { SettingsManual } from "@/components/admin/settings/SettingsManual"

export default function AdminSettingsPage() {
  const [cfg, setCfg]         = useState<Config>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.ok ? r.json() : {})
      .then(setCfg)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof Config, val: string) {
    setCfg(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    try {
      const payload: Record<string, number | string> = {}
      // Use !== "" guards instead of truthiness so a numeric 0 is not silently dropped.
      for (const key of NUMERIC_KEYS) {
        const raw = cfg[key]
        if (raw !== undefined && raw !== "") payload[key] = parseInt(raw, 10)
      }
      if (cfg.payout_schedule !== undefined && cfg.payout_schedule !== "") {
        payload.payout_schedule = cfg.payout_schedule
      }

      // Catch a bad value (mistyped, or nudged by an accidental mouse-wheel scroll) before it ever
      // leaves the browser, with a message that says exactly which field and why.
      const errors: string[] = []
      for (const [key, bound] of Object.entries(FIELD_BOUNDS)) {
        const val = payload[key]
        if (typeof val === "number" && (Number.isNaN(val) || val < bound.min || val > bound.max)) {
          errors.push(`${bound.label} must be between ${bound.min} and ${bound.max} (got ${Number.isNaN(val) ? "an invalid number" : val})`)
        }
      }
      if (errors.length > 0) {
        toast.error(errors.join(" · "))
        return
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success("Settings saved")
      } else {
        const d = await res.json().catch(() => ({}))
        const fieldErrs = d?.details?.fieldErrors as Record<string, string[]> | undefined
        if (fieldErrs && Object.keys(fieldErrs).length > 0) {
          toast.error(Object.entries(fieldErrs).map(([k, v]) => `${FIELD_BOUNDS[k]?.label ?? k}: ${v.join(", ")}`).join(" · "))
        } else {
          toast.error(d.error ?? "Save failed")
        }
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#2D7A5F]" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
          <Settings size={18} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Platform Settings</h1>
          <p className="text-sm text-[#6B7280]">Changes apply immediately — the very next request reads the new value, no restart and no waiting for a &quot;cycle.&quot;</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        <MoneySection cfg={cfg} set={set} />
        <ReferralSection cfg={cfg} set={set} />
        <OperationsSection cfg={cfg} set={set} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Saving…" : "Save Settings"}
      </button>

      <SettingsManual cfg={cfg} />
    </div>
  )
}
