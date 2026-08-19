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
  cancel_tier1_hours?:          string
  cancel_tier2_hours?:          string
  cancel_tier3_hours?:          string
  cancel_fee_low_pct?:          string
  cancel_fee_medium_pct?:       string
  cancel_fee_late_pct?:         string
  cancel_travel_comp_cents?:    string
  cancel_noshow_grace_minutes?: string
  cleaner_peer_referral_pct?:    string
  client_referral_discount_pct?: string
  recurring_discount_pct?:       string
  min_hourly_rate_cents?:        string
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
      if (cfg.cancel_tier1_hours          !== undefined && cfg.cancel_tier1_hours          !== "") payload.cancel_tier1_hours          = parseInt(cfg.cancel_tier1_hours, 10)
      if (cfg.cancel_tier2_hours          !== undefined && cfg.cancel_tier2_hours          !== "") payload.cancel_tier2_hours          = parseInt(cfg.cancel_tier2_hours, 10)
      if (cfg.cancel_tier3_hours          !== undefined && cfg.cancel_tier3_hours          !== "") payload.cancel_tier3_hours          = parseInt(cfg.cancel_tier3_hours, 10)
      if (cfg.cancel_fee_low_pct          !== undefined && cfg.cancel_fee_low_pct          !== "") payload.cancel_fee_low_pct          = parseInt(cfg.cancel_fee_low_pct, 10)
      if (cfg.cancel_fee_medium_pct       !== undefined && cfg.cancel_fee_medium_pct       !== "") payload.cancel_fee_medium_pct       = parseInt(cfg.cancel_fee_medium_pct, 10)
      if (cfg.cancel_fee_late_pct         !== undefined && cfg.cancel_fee_late_pct         !== "") payload.cancel_fee_late_pct         = parseInt(cfg.cancel_fee_late_pct, 10)
      if (cfg.cancel_travel_comp_cents    !== undefined && cfg.cancel_travel_comp_cents    !== "") payload.cancel_travel_comp_cents    = parseInt(cfg.cancel_travel_comp_cents, 10)
      if (cfg.cancel_noshow_grace_minutes !== undefined && cfg.cancel_noshow_grace_minutes !== "") payload.cancel_noshow_grace_minutes = parseInt(cfg.cancel_noshow_grace_minutes, 10)
      if (cfg.cleaner_peer_referral_pct    !== undefined && cfg.cleaner_peer_referral_pct    !== "") payload.cleaner_peer_referral_pct    = parseInt(cfg.cleaner_peer_referral_pct, 10)
      if (cfg.client_referral_discount_pct !== undefined && cfg.client_referral_discount_pct !== "") payload.client_referral_discount_pct = parseInt(cfg.client_referral_discount_pct, 10)
      if (cfg.recurring_discount_pct       !== undefined && cfg.recurring_discount_pct       !== "") payload.recurring_discount_pct       = parseInt(cfg.recurring_discount_pct, 10)
      if (cfg.min_hourly_rate_cents        !== undefined && cfg.min_hourly_rate_cents        !== "") payload.min_hourly_rate_cents        = parseInt(cfg.min_hourly_rate_cents, 10)

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
              min={0}
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

        {/* Minimum wage floor */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Minimum Hourly Rate (€ cents)
          </label>
          <p className="text-xs text-[#6B7280] mb-3">
            Applies wherever an hourly rate is set on either side of the marketplace — a client
            posting a job, or a cleaner listing a per-hour service. Neither can go below this.
            One flat number for both the EUR and USD markets (same as travel compensation above).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100000}
              value={cfg.min_hourly_rate_cents ?? "1500"}
              onChange={e => set("min_hourly_rate_cents", e.target.value)}
              className="w-32 h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
            />
            <span className="text-sm text-[#6B7280]">1500 = €15.00/hr</span>
          </div>
        </div>

        {/* Referral & discount programme */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Referral &amp; Discount Programme
          </label>
          <p className="text-xs text-[#6B7280] mb-4">
            Cleaners earn cash commission (paid out via Stripe); clients earn a discount balance
            (spendable at checkout or withdrawable). All rates are % of booking subtotal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Cleaner → Client commission %</label>
              <input
                type="number"
                min={0}
                max={20}
                value={cfg.referral_pct ?? "5"}
                onChange={e => set("referral_pct", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <p className="text-xs text-[#6B7280] mt-1">Cleaner invites a client — paid on every completed booking, ongoing.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Cleaner → Cleaner commission %</label>
              <input
                type="number"
                min={0}
                max={20}
                value={cfg.cleaner_peer_referral_pct ?? "10"}
                onChange={e => set("cleaner_peer_referral_pct", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <p className="text-xs text-[#6B7280] mt-1">Cleaner invites a cleaner — only the invited cleaner&apos;s first 3 completed jobs.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Client referral discount %</label>
              <input
                type="number"
                min={0}
                max={20}
                value={cfg.client_referral_discount_pct ?? "5"}
                onChange={e => set("client_referral_discount_pct", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <p className="text-xs text-[#6B7280] mt-1">Client invites anyone (client or cleaner) — credited as balance, ongoing.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Recurring booking discount %</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={50}
                value={cfg.recurring_discount_pct ?? "10"}
                onChange={e => set("recurring_discount_pct", e.target.value)}
                className="w-24 h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <span className="text-sm text-[#6B7280]">% off the client's 2nd and 3rd cleaning on a recurring schedule, all cleaners (was per-cleaner — now platform-wide)</span>
            </div>
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

        {/* Cancellation & no-show policy */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Cancellation &amp; No-Show Policy
          </label>
          <p className="text-xs text-[#6B7280] mb-4">
            Fees are a reasonable estimate of the cleaner&apos;s lost-slot loss, not a penalty — see
            Terms of Service Section 9. Changes apply to the very next cancellation or no-show report.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Free window (hours)</label>
              <input type="number" min={1} max={168} value={cfg.cancel_tier1_hours ?? "24"} onChange={e => set("cancel_tier1_hours", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Medium-fee window (hours)</label>
              <input type="number" min={1} max={168} value={cfg.cancel_tier2_hours ?? "6"} onChange={e => set("cancel_tier2_hours", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Late-fee window (hours)</label>
              <input type="number" min={0} max={168} value={cfg.cancel_tier3_hours ?? "2"} onChange={e => set("cancel_tier3_hours", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
          </div>
          <p className="text-xs text-[#6B7280] mb-4">
            More than {cfg.cancel_tier1_hours ?? "24"}h before the job → free. Between {cfg.cancel_tier2_hours ?? "6"}h
            and {cfg.cancel_tier1_hours ?? "24"}h → low fee. Between {cfg.cancel_tier3_hours ?? "2"}h and {cfg.cancel_tier2_hours ?? "6"}h
            → medium fee. Less than {cfg.cancel_tier3_hours ?? "2"}h → late fee + travel compensation.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Low fee %</label>
              <input type="number" min={0} max={100} value={cfg.cancel_fee_low_pct ?? "10"} onChange={e => set("cancel_fee_low_pct", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Medium fee %</label>
              <input type="number" min={0} max={100} value={cfg.cancel_fee_medium_pct ?? "30"} onChange={e => set("cancel_fee_medium_pct", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Late fee %</label>
              <input type="number" min={0} max={100} value={cfg.cancel_fee_late_pct ?? "100"} onChange={e => set("cancel_fee_late_pct", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Travel compensation (€ cents)</label>
              <input type="number" min={0} max={50000} value={cfg.cancel_travel_comp_cents ?? "500"} onChange={e => set("cancel_travel_comp_cents", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
              <p className="text-xs text-[#6B7280] mt-1">Paid straight to the cleaner on a late cancellation. 500 = €5.00.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">No-show grace period (minutes)</label>
              <input type="number" min={0} max={120} value={cfg.cancel_noshow_grace_minutes ?? "15"} onChange={e => set("cancel_noshow_grace_minutes", e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
              <p className="text-xs text-[#6B7280] mt-1">Wait time after the scheduled start before either party can report a no-show.</p>
            </div>
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
