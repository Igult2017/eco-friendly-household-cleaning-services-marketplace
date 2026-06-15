"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "next-intl"
import { AlertTriangle } from "lucide-react"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import { usePostalValidation } from "@/hooks/usePostalValidation"
import type { GeoResult } from "@/lib/nominatim"

interface ProviderFieldValues {
  businessName: string
  bio: string
  city: string
  postalCode: string
  country: string
  serviceRadiusKm: string
  ecoLevel: string
}

interface Props {
  values: ProviderFieldValues
  onChange: (key: keyof ProviderFieldValues, value: string) => void
  onValidChange?: (valid: boolean) => void
}

const EU_COUNTRIES: [string, string][] = [
  ["DE", "Germany"], ["NL", "Netherlands"], ["BE", "Belgium"], ["AT", "Austria"],
  ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["PL", "Poland"],
  ["SE", "Sweden"], ["DK", "Denmark"], ["FI", "Finland"], ["NO", "Norway"],
  ["CH", "Switzerland"], ["PT", "Portugal"], ["IE", "Ireland"],
]

const ECO_LEVEL_KEYS = ["basic", "certified", "premium", "zero_impact"] as const

const ECO_LEVEL_LABEL_KEYS: Record<string, string> = {
  basic: "ecoLevelBasic",
  certified: "ecoLevelCertified",
  premium: "ecoLevelPremium",
  zero_impact: "ecoLevelZeroImpact",
}

export function ProviderFields({ values, onChange, onValidChange }: Props) {
  const t = useTranslations("authOnboardingProviderFields")
  const postal = usePostalValidation()

  function handleDetect(result: GeoResult) {
    onChange("city", result.city)
    onChange("postalCode", result.postalCode)
    if (EU_COUNTRIES.some(([code]) => code === result.country)) onChange("country", result.country)
    postal.clear()
    onValidChange?.(true)
  }

  async function validatePostal() {
    const ok = await postal.validate(values.postalCode, values.country, values.city)
    onValidChange?.(ok)
  }

  return (
    <div className="space-y-4 border-t border-[#E5EDE9] pt-5">
      <p className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-wide">{t("businessInfo")}</p>

      <div>
        <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("businessNameLabel")}</Label>
        <Input value={values.businessName} onChange={e => onChange("businessName", e.target.value)} placeholder={t("businessNamePlaceholder")} />
      </div>

      <div>
        <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("aboutYouLabel")}</Label>
        <Textarea value={values.bio} onChange={e => onChange("bio", e.target.value)}
          placeholder={t("bioPlaceholder")} rows={3} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#2B3441] uppercase tracking-wide">{t("location")}</p>
          <LocationDetectButton onDetect={handleDetect} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("cityLabel")}</Label>
            <Input value={values.city} onChange={e => onChange("city", e.target.value)}
              onBlur={validatePostal} placeholder={t("cityPlaceholder")} />
          </div>
          <div>
            <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("postalCodeLabel")}</Label>
            <Input value={values.postalCode} onChange={e => onChange("postalCode", e.target.value)}
              onBlur={validatePostal} placeholder={t("postalCodePlaceholder")} />
          </div>
        </div>

        {postal.postalError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span className="flex-1">{postal.postalError}</span>
            {postal.canonicalCity && (
              <button type="button" onClick={() => { onChange("city", postal.canonicalCity!); postal.clear(); onValidChange?.(true) }}
                className="shrink-0 font-semibold underline hover:text-amber-900 transition-colors">
                {t("useCanonicalCity", { city: postal.canonicalCity })}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("countryLabel")}</Label>
          <Select value={values.country} onValueChange={v => { if (v) onChange("country", v) }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EU_COUNTRIES.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("serviceRadiusLabel")}</Label>
          <Input type="number" min={1} max={100} value={values.serviceRadiusKm}
            onChange={e => onChange("serviceRadiusKm", e.target.value)} placeholder={t("serviceRadiusPlaceholder")} />
        </div>
      </div>

      <div>
        <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("ecoLevelLabel")}</Label>
        <Select value={values.ecoLevel} onValueChange={v => { if (v) onChange("ecoLevel", v) }}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ECO_LEVEL_KEYS.map(value => <SelectItem key={value} value={value}>{t(ECO_LEVEL_LABEL_KEYS[value])}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
