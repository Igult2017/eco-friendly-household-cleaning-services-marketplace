"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Save, AlertTriangle } from "lucide-react"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import { PricingSummaryCard } from "@/components/provider/PricingSummaryCard"
import { usePostalValidation } from "@/hooks/usePostalValidation"
import { RoleBadge } from "@/components/layout/RoleBadge"
import type { GeoResult } from "@/lib/nominatim"

type Profile = {
  businessName: string
  bio: string
  city: string
  postalCode: string
  country: string
  serviceRadiusKm: number
  carbonOffsetEnabled: boolean
  recurringDiscountPct: number
}

export default function ProviderProfilePage() {
  const t = useTranslations("providerProviderProfilePage")
  const [profile, setProfile] = useState<Profile>({
    businessName: "", bio: "", city: "", postalCode: "",
    country: "DE", serviceRadiusKm: 25, carbonOffsetEnabled: false, recurringDiscountPct: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [locationValid, setLocationValid] = useState(true)
  const postal = usePostalValidation()

  function handleDetect(result: GeoResult) {
    setProfile((p) => ({ ...p, city: result.city, postalCode: result.postalCode }))
    postal.clear()
    setLocationValid(true)
  }

  async function validatePostal() {
    const ok = await postal.validate(profile.postalCode, profile.country, profile.city)
    setLocationValid(ok)
  }

  useEffect(() => {
    fetch("/api/providers/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) {
          setProfile({
            businessName: d.provider.businessName ?? "",
            bio: d.provider.bio ?? "",
            city: d.provider.city ?? "",
            postalCode: d.provider.postalCode ?? "",
            country: d.provider.country ?? "DE",
            serviceRadiusKm: d.provider.serviceRadiusKm ?? 25,
            carbonOffsetEnabled: d.provider.carbonOffsetEnabled ?? false,
            recurringDiscountPct: d.provider.recurringDiscountPct ?? 0,
          })
        }
        setLoading(false)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/providers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d?.error === "string" ? d.error : "Couldn't save your profile. Please try again.")
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("Couldn't save your profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" /></div>
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subheading")}</p>
        <div className="mt-3"><RoleBadge variant="cleaner" /></div>
      </div>

      <div className="rounded-xl bg-white shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("businessNameLabel")}</label>
          <input
            type="text" value={profile.businessName}
            onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("bioLabel")}</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            rows={4} placeholder={t("bioPlaceholder")}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F] resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#2B3441] uppercase tracking-wide">{t("locationLabel")}</span>
            <LocationDetectButton onDetect={handleDetect} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("cityLabel")}</label>
              <input type="text" value={profile.city}
                onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                onBlur={validatePostal}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("postalCodeLabel")}</label>
              <input type="text" value={profile.postalCode}
                onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))}
                onBlur={validatePostal}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
              />
            </div>
          </div>
          {postal.postalError && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span className="flex-1">{postal.postalError}</span>
              {postal.canonicalCity && (
                <button type="button" onClick={() => { setProfile((p) => ({ ...p, city: postal.canonicalCity! })); postal.clear(); setLocationValid(true) }}
                  className="shrink-0 font-semibold underline hover:text-amber-900 transition-colors">
                  {t("useSuggestedCity", { city: postal.canonicalCity })}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">
            {t("serviceRadiusLabel", { km: profile.serviceRadiusKm })}
          </label>
          <input type="range" min={5} max={100} step={5} value={profile.serviceRadiusKm}
            onChange={(e) => setProfile((p) => ({ ...p, serviceRadiusKm: Number(e.target.value) }))}
            className="w-full accent-[#2D7A5F]"
          />
          <div className="flex justify-between text-xs text-[#6B7280] mt-1"><span>{t("radiusMin")}</span><span>{t("radiusMax")}</span></div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={profile.carbonOffsetEnabled}
            onChange={(e) => setProfile((p) => ({ ...p, carbonOffsetEnabled: e.target.checked }))}
            className="h-4 w-4 accent-[#2D7A5F]"
          />
          <div>
            <p className="text-sm font-medium text-[#2B3441]">{t("carbonOffsetTitle")}</p>
            <p className="text-xs text-[#6B7280]">{t("carbonOffsetDescription")}</p>
          </div>
        </label>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("recurringDiscountLabel")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={50} step={1} value={profile.recurringDiscountPct}
              onChange={(e) => setProfile((p) => ({ ...p, recurringDiscountPct: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))}
              className="w-24 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
            />
            <span className="text-sm text-[#6B7280]">{t("recurringDiscountSuffix")}</span>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">{t("recurringDiscountHint")}</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={save} disabled={saving || !locationValid}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2D7A5F] py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? t("saveButtonSaved") : saving ? t("saveButtonSaving") : t("saveButton")}
        </button>
      </div>

      <PricingSummaryCard />
    </div>
  )
}
