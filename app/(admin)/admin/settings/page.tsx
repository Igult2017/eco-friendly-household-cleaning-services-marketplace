"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { Settings, Save, Loader2, BookOpen } from "lucide-react"
import { toast } from "sonner"

interface Config {
  commission_pct?:        string
  referral_pct?:          string
  payout_schedule?:       string
  max_service_radius_km?: string
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

// Mirrors the server-side zod bounds in app/api/admin/settings/route.ts exactly — checked here FIRST
// so a mistyped or scroll-wheel-nudged value never has to make a round trip to find out it's rejected.
const FIELD_BOUNDS: Record<string, { min: number; max: number; label: string }> = {
  commission_pct:                { min: 0,  max: 50,      label: "Platform Commission %" },
  min_hourly_rate_cents:         { min: 0,  max: 100_000, label: "Minimum Hourly Rate" },
  referral_pct:                  { min: 0,  max: 20,      label: "Cleaner → Client commission %" },
  cleaner_peer_referral_pct:     { min: 0,  max: 20,      label: "Cleaner → Cleaner commission %" },
  client_referral_discount_pct:  { min: 0,  max: 20,      label: "Client referral discount % / Affiliate rate" },
  recurring_discount_pct:        { min: 0,  max: 50,      label: "Recurring booking discount %" },
  max_service_radius_km:         { min: 10, max: 500,     label: "Maximum Service Radius" },
  cancel_tier1_hours:            { min: 1,  max: 168,     label: "Free window (hours)" },
  cancel_tier2_hours:            { min: 1,  max: 168,     label: "Medium-fee window (hours)" },
  cancel_tier3_hours:            { min: 0,  max: 168,     label: "Late-fee window (hours)" },
  cancel_fee_low_pct:            { min: 0,  max: 100,     label: "Low fee %" },
  cancel_fee_medium_pct:         { min: 0,  max: 100,     label: "Medium fee %" },
  cancel_fee_late_pct:           { min: 0,  max: 100,     label: "Late fee %" },
  cancel_travel_comp_cents:      { min: 0,  max: 50_000,  label: "Travel compensation" },
  cancel_noshow_grace_minutes:   { min: 0,  max: 120,     label: "No-show grace period" },
}

// Scrolling the page while the mouse happens to rest over a focused number field silently changes
// its value in most browsers — blurring on wheel stops that from ever happening.
function blurOnWheel(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur()
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
          const msgs = Object.entries(fieldErrs).map(([k, v]) => `${FIELD_BOUNDS[k]?.label ?? k}: ${v.join(", ")}`)
          toast.error(msgs.join(" · "))
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

  // Live numbers for the manual's worked examples below — recalculated from whatever is on screen
  // right now (including unsaved edits), the same math as lib/stripe/client.ts.
  const commission = parseInt(cfg.commission_pct ?? "15") || 0
  const recurringPct = parseInt(cfg.recurring_discount_pct ?? "10") || 0
  const exampleSubtotal = 100
  const platformFee = Math.round(exampleSubtotal * commission / 100)
  const cleanerReceives = exampleSubtotal - platformFee
  const recurringDiscountRaw = Math.round(exampleSubtotal * recurringPct / 100)
  const recurringDiscountCapped = Math.min(recurringDiscountRaw, platformFee)
  const netPlatformFeeRecurring = platformFee - recurringDiscountCapped
  const clientPaysRecurring = exampleSubtotal - recurringDiscountCapped
  const promoExampleDiscount = 10
  const subtotalAfterPromo = exampleSubtotal - promoExampleDiscount
  const platformFeeAfterPromo = Math.round(subtotalAfterPromo * commission / 100)
  const cleanerReceivesAfterPromo = subtotalAfterPromo - platformFeeAfterPromo
  const cleanerLossFromPromo = cleanerReceives - cleanerReceivesAfterPromo
  const platformLossFromPromo = platformFee - platformFeeAfterPromo

  return (
    <div className="space-y-8 max-w-3xl">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
          <Settings size={18} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Platform Settings</h1>
          <p className="text-sm text-[#6B7280]">Changes apply immediately — the very next request reads the new value, no restart and no waiting for a "cycle."</p>
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
              onWheel={blurOnWheel}
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
            One flat number for both the EUR and USD markets (same as travel compensation below).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100000}
              value={cfg.min_hourly_rate_cents ?? "1500"}
              onChange={e => set("min_hourly_rate_cents", e.target.value)}
              onWheel={blurOnWheel}
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
                onWheel={blurOnWheel}
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
                onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <p className="text-xs text-[#6B7280] mt-1">Cleaner invites a cleaner — only the invited cleaner&apos;s first 3 completed jobs.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Client referral discount % — also the Affiliate Programme rate</label>
              <input
                type="number"
                min={0}
                max={20}
                value={cfg.client_referral_discount_pct ?? "5"}
                onChange={e => set("client_referral_discount_pct", e.target.value)}
                onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <p className="text-xs text-[#6B7280] mt-1">Client invites anyone (client or cleaner) — credited as balance, ongoing. This is ALSO the exact rate a standalone Affiliate/Partner earns — they're not a cleaner, so they're paid through this same setting, not "Cleaner → Client commission %" above.</p>
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
                onWheel={blurOnWheel}
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
            How often a newly connected cleaner's Stripe account pays out to their bank. Only applies
            to accounts connected AFTER this is changed — it does not retroactively change the
            schedule of a cleaner who already connected.
          </p>
          <select
            value={cfg.payout_schedule ?? "weekly"}
            onChange={e => set("payout_schedule", e.target.value)}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
          >
            <option value="weekly">Weekly (Monday)</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Max service radius */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-[#2B3441] mb-1">
            Maximum Service Radius (km)
          </label>
          <p className="text-xs text-[#6B7280] mb-3">
            Hard cap on how far a provider can set their own service area.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={10}
              max={500}
              value={cfg.max_service_radius_km ?? "100"}
              onChange={e => set("max_service_radius_km", e.target.value)}
              onWheel={blurOnWheel}
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
              <input type="number" min={1} max={168} value={cfg.cancel_tier1_hours ?? "24"} onChange={e => set("cancel_tier1_hours", e.target.value)} onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Medium-fee window (hours)</label>
              <input type="number" min={1} max={168} value={cfg.cancel_tier2_hours ?? "6"} onChange={e => set("cancel_tier2_hours", e.target.value)} onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Late-fee window (hours)</label>
              <input type="number" min={0} max={168} value={cfg.cancel_tier3_hours ?? "2"} onChange={e => set("cancel_tier3_hours", e.target.value)} onWheel={blurOnWheel}
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
              <input type="number" min={0} max={100} value={cfg.cancel_fee_low_pct ?? "10"} onChange={e => set("cancel_fee_low_pct", e.target.value)} onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Medium fee %</label>
              <input type="number" min={0} max={100} value={cfg.cancel_fee_medium_pct ?? "30"} onChange={e => set("cancel_fee_medium_pct", e.target.value)} onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Late fee %</label>
              <input type="number" min={0} max={100} value={cfg.cancel_fee_late_pct ?? "100"} onChange={e => set("cancel_fee_late_pct", e.target.value)} onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Travel compensation (€ cents)</label>
              <input type="number" min={0} max={50000} value={cfg.cancel_travel_comp_cents ?? "500"} onChange={e => set("cancel_travel_comp_cents", e.target.value)} onWheel={blurOnWheel}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]" />
              <p className="text-xs text-[#6B7280] mt-1">Paid straight to the cleaner on a late cancellation. 500 = €5.00.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">No-show grace period (minutes)</label>
              <input type="number" min={0} max={120} value={cfg.cancel_noshow_grace_minutes ?? "15"} onChange={e => set("cancel_noshow_grace_minutes", e.target.value)} onWheel={blurOnWheel}
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

      {/* The manual — plain-English reference for what each setting above actually does, with the
          money math worked out using whatever is currently on screen (including unsaved edits), so
          the examples never drift from the real numbers. */}
      <details className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <summary className="cursor-pointer select-none px-6 py-5 flex items-center gap-3 text-sm font-semibold text-[#2B3441]">
          <BookOpen size={16} className="text-[#2D7A5F]" />
          What each setting does — the money math explained
        </summary>

        <div className="px-6 pb-6 space-y-6 text-sm text-[#2B3441]">

          <div>
            <p className="font-semibold mb-1">Platform Commission %</p>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              The customer always pays the cleaner&apos;s posted rate — nothing is ever added on top.
              This percentage is instead <em>deducted from the cleaner&apos;s payout</em>: think of it
              as the cleaner renting the platform to reach clients. Code path:
              {" "}<code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">calculateBookingAmounts()</code> in
              {" "}<code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">lib/stripe/client.ts</code>.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">Minimum Hourly Rate</p>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              A wage floor, not a price cap. Neither a client posting a job at an hourly rate, nor a
              cleaner listing their own hourly service price, is allowed to go below this number —
              protects cleaners from being undercut into an unsustainable rate.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-2">Referral &amp; Discount Programme — two different mechanisms, worked out</p>
            <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
              <strong>The recurring discount (and every referral reward) comes ONLY out of the
              platform&apos;s own commission — it never touches what the cleaner is paid,</strong> and
              it&apos;s automatically capped so it can never exceed the commission itself. On a
              €{exampleSubtotal} job at your current {commission}% commission and {recurringPct}%
              recurring discount:
            </p>
            <div className="bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs space-y-1 mb-3">
              <p>Full price, no discount: platform keeps <span className="font-semibold">€{platformFee}</span> ({commission}%), cleaner receives <span className="font-semibold">€{cleanerReceives}</span></p>
              <p>With the {recurringPct}% discount applied: client pays <span className="font-semibold">€{clientPaysRecurring}</span>, cleaner STILL receives <span className="font-semibold text-[#2D7A5F]">€{cleanerReceives}</span> (unchanged), platform now keeps only <span className="font-semibold">€{netPlatformFeeRecurring}</span> ({exampleSubtotal > 0 ? Math.round(netPlatformFeeRecurring / exampleSubtotal * 100) : 0}%)</p>
              {recurringDiscountRaw > platformFee && (
                <p className="text-amber-700">Note: a {recurringPct}% discount would exceed the {commission}% commission, so it&apos;s capped at €{recurringDiscountCapped} — raise commission if you want the full {recurringPct}% to reach clients.</p>
              )}
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
              <strong>The Affiliate Programme doesn&apos;t have its own rate control</strong> — an
              affiliate signs up with role &quot;affiliate&quot;, not &quot;provider&quot;, so they&apos;re
              paid through the exact same code path as &quot;Client referral discount %&quot; above, not
              &quot;Cleaner → Client commission %&quot;. Changing the &quot;Client referral discount %&quot;
              field above changes what affiliates earn too, and the public <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">/affiliate</code> page
              always advertises this same live number, so the two can never drift apart.
            </p>
            <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
              <strong>Promo codes and spending a referral-credit balance at checkout work differently</strong> —
              that discount is subtracted from the price BEFORE the commission split, so it&apos;s shared
              proportionally between the platform and the cleaner. On the same €{exampleSubtotal} job
              with a flat €{promoExampleDiscount} promo code or credit applied:
            </p>
            <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs space-y-1">
              <p>Client pays <span className="font-semibold">€{subtotalAfterPromo}</span> (correct — €{promoExampleDiscount} off)</p>
              <p>Cleaner receives <span className="font-semibold">€{cleanerReceivesAfterPromo}</span> — <span className="font-semibold text-amber-700">€{cleanerLossFromPromo} LESS</span> than the full-price €{cleanerReceives}</p>
              <p>Platform keeps <span className="font-semibold">€{platformFeeAfterPromo}</span> — €{platformLossFromPromo} less than usual</p>
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed mt-2">
              In other words: the cleaner absorbs most of a promo-code/credit discount, proportional to
              their own share of the price. This is a real difference between the two mechanisms, not a
              bug — whether it should stay this way is a product decision, not something this page
              silently changes.
              Code paths: recurring/referral —
              {" "}<code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">calculateDiscountedBookingAmounts()</code>,
              {" "}<code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">lib/stripe/client.ts</code>;
              promo/credit — <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">app/api/payments/intent/route.ts</code>.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">Default Payout Schedule</p>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Sets how often a cleaner&apos;s Stripe account pays out to their bank, applied when their
              Connect account is first created (<code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">lib/stripe/connect.ts</code>).
              Stripe only supports Weekly or Monthly — not Bi-weekly. Changing this only affects cleaners
              who connect an account AFTER the change; it does not move existing cleaners onto a new
              schedule retroactively.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">Maximum Service Radius</p>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              The hard ceiling on how far a cleaner can set their own service area (their per-account
              radius slider, elsewhere in the app). Enforced live wherever a cleaner saves their profile
              or completes onboarding.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">Cancellation &amp; No-Show Policy</p>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              A 3-tier fee based on how close to the job a cancellation happens — further out, cheaper;
              last-minute, the full late fee plus a flat travel-compensation payment straight to the
              cleaner (they may have already travelled or blocked the time). The no-show grace period is
              how long either party must wait past the scheduled start before reporting the other as a
              no-show, so a few minutes of normal lateness can&apos;t be reported immediately.
            </p>
          </div>

        </div>
      </details>

    </div>
  )
}
