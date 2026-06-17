"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { Settings, Save, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface Config {
  commission_pct?:        string
  referral_pct?:          string
  payout_schedule?:       string
  max_service_radius_km?: string
  platform_name?:         string
}

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
      // Use !== "" guards instead of truthiness so numeric value 0 is not silently dropped
      if (cfg.commission_pct        !== undefined && cfg.commission_pct        !== "") payload.commission_pct        = parseInt(cfg.commission_pct, 10)
      if (cfg.referral_pct          !== undefined && cfg.referral_pct          !== "") payload.referral_pct          = parseInt(cfg.referral_pct, 10)
      if (cfg.payout_schedule       !== undefined && cfg.payout_schedule       !== "") payload.payout_schedule        = cfg.payout_schedule
      if (cfg.max_service_radius_km !== undefined && cfg.max_service_radius_km !== "") payload.max_service_radius_km = parseInt(cfg.max_service_radius_km, 10)
      if (cfg.platform_name         !== undefined && cfg.platform_name         !== "") payload.platform_name          = cfg.platform_name

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success("Settings saved")
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "Save failed")
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
          <p className="text-sm text-[#6B7280]">Changes take effect on the next booking or payout cycle</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">

        {/* Commission */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Platform Commission %
          </label>
          <p className="text-xs text-[#6B7280] mb-3">
            Deducted from the cleaner&apos;s payout (the cleaner pays this to use the platform).
            The customer pays the cleaner&apos;s rate — nothing is added on top. Changing this
            only affects new bookings — existing bookings keep their original rate.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={50}
              value={cfg.commission_pct ?? "15"}
              onChange={e => set("commission_pct", e.target.value)}
              className="w-24 h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
            />
            <span className="text-sm text-[#6B7280]">% of the cleaner&apos;s rate</span>
          </div>
          <div className="mt-3 bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs text-[#2B3441] space-y-1">
            <p>Cleaner&apos;s rate <span className="font-semibold">€100</span></p>
            <p>Customer pays <span className="font-semibold">€100</span> (nothing added)</p>
            <p>Platform commission <span className="font-semibold text-[#2D7A5F]">€{parseInt(cfg.commission_pct ?? "15")}</span> ({cfg.commission_pct ?? 15}%)</p>
            <p>Cleaner receives <span className="font-semibold">€{100 - parseInt(cfg.commission_pct ?? "15")}</span></p>
          </div>
        </div>

        {/* Referral */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Referral Commission %
          </label>
          <p className="text-xs text-[#6B7280] mb-3">
            Percentage of each booking value credited to the referrer&apos;s wallet.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={20}
              value={cfg.referral_pct ?? "5"}
              onChange={e => set("referral_pct", e.target.value)}
              className="w-24 h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
            />
            <span className="text-sm text-[#6B7280]">% of booking subtotal</span>
          </div>
        </div>

        {/* Payout schedule */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Default Payout Schedule
          </label>
          <p className="text-xs text-[#6B7280] mb-3">
            When providers are paid. Individual providers can override this in their settings.
          </p>
          <select
            value={cfg.payout_schedule ?? "weekly"}
            onChange={e => set("payout_schedule", e.target.value)}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
          >
            <option value="weekly">Weekly (Monday 02:00 UTC)</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Max service radius */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Maximum Service Radius (km)
          </label>
          <p className="text-xs text-[#6B7280] mb-3">
            Hard cap on how far a provider can set their service area.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={10}
              max={500}
              value={cfg.max_service_radius_km ?? "100"}
              onChange={e => set("max_service_radius_km", e.target.value)}
              className="w-24 h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
            />
            <span className="text-sm text-[#6B7280]">km</span>
          </div>
        </div>

      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Saving…" : "Save Settings"}
      </button>

    </div>
  )
}
