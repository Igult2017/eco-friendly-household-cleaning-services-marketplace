"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import { usePostalValidation } from "@/hooks/usePostalValidation"
import type { GeoResult } from "@/lib/nominatim"
import type { ProviderProfileInput } from "@/lib/validations/provider"

const ECO_LEVELS = ["basic", "certified", "premium", "zero_impact"] as const

interface Props {
  onSubmit: (data: ProviderProfileInput) => Promise<void>
}

export function BusinessDetailsForm({ onSubmit }: Props) {
  const t = useTranslations("compOnboardingBusinessDetailsForm")
  const [loading, setLoading] = useState(false)
  const [locationValid, setLocationValid] = useState(true)
  const postal = usePostalValidation()
  const [form, setForm] = useState<ProviderProfileInput>({
    businessName: "",
    bio: "",
    city: "",
    postalCode: "",
    country: "DE",
    serviceRadiusKm: 25,
    ecoLevel: "basic",
  })

  function set(field: keyof ProviderProfileInput, value: string | number | null) {
    if (value !== null) setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleDetect(result: GeoResult) {
    setForm((prev) => ({ ...prev, city: result.city, postalCode: result.postalCode }))
    postal.clear()
    setLocationValid(true)
  }

  async function validatePostal() {
    const ok = await postal.validate(form.postalCode, form.country, form.city)
    setLocationValid(ok)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="businessName" className="text-[#2B3441] text-sm font-medium mb-1.5 block">
          {t("businessNameLabel")}
        </Label>
        <Input
          id="businessName"
          value={form.businessName}
          onChange={(e) => set("businessName", e.target.value)}
          placeholder={t("businessNamePlaceholder")}
          required
          minLength={2}
        />
      </div>

      <div>
        <Label htmlFor="bio" className="text-[#2B3441] text-sm font-medium mb-1.5 block">
          {t("bioLabel")}
        </Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder={t("bioPlaceholder")}
          required
          minLength={20}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-[#6B7280] mt-1">{t("bioCharCount", { count: form.bio.length })}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#2B3441] uppercase tracking-wide">{t("locationHeading")}</p>
          <LocationDetectButton onDetect={handleDetect} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city" className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("cityLabel")}</Label>
            <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} onBlur={validatePostal} placeholder={t("cityPlaceholder")} required />
          </div>
          <div>
            <Label htmlFor="postalCode" className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("postalCodeLabel")}</Label>
            <Input id="postalCode" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} onBlur={validatePostal} placeholder={t("postalCodePlaceholder")} required />
          </div>
        </div>
        {postal.postalError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span className="flex-1">{postal.postalError}</span>
            {postal.canonicalCity && (
              <button type="button" onClick={() => { set("city", postal.canonicalCity!); postal.clear(); setLocationValid(true) }}
                className="shrink-0 font-semibold underline hover:text-amber-900 transition-colors">
                {t("useCanonicalCity", { city: postal.canonicalCity })}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("serviceRadiusLabel")}</Label>
          <Input
            type="number"
            value={form.serviceRadiusKm}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (!isNaN(v)) set("serviceRadiusKm", v)
            }}
            min={1}
            max={100}
          />
        </div>
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("ecoLevelLabel")}</Label>
          <Select value={form.ecoLevel} onValueChange={(v) => set("ecoLevel", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ECO_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{t(`ecoLevel_${l}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={loading || !locationValid} className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11">
        {loading ? t("savingButton") : t("saveContinueButton")}
      </Button>
    </form>
  )
}
