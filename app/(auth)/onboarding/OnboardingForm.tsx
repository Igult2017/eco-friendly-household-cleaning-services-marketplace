"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Home, Briefcase, Megaphone, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ProviderFields } from "./ProviderFields"

type Role = "customer" | "provider" | "affiliate"

const ROLE_CARDS = [
  { value: "customer" as Role, icon: Home, titleKey: "customerCardTitle", descKey: "customerCardDesc" },
  { value: "provider" as Role, icon: Briefcase, titleKey: "providerCardTitle", descKey: "providerCardDesc" },
  { value: "affiliate" as Role, icon: Megaphone, titleKey: "affiliateCardTitle", descKey: "affiliateCardDesc" },
]

interface Props {
  defaultFirstName?: string
  defaultLastName?: string
  defaultRole?: Role
}

export function OnboardingForm({ defaultFirstName = "", defaultLastName = "", defaultRole }: Props) {
  const t = useTranslations("authOnboardingOnboardingForm")
  const [role, setRole] = useState<Role | null>(defaultRole ?? null)
  const [firstName, setFirstName] = useState(defaultFirstName)
  const [lastName, setLastName] = useState(defaultLastName)
  const [phone, setPhone] = useState("")
  const [gdpr, setGdpr] = useState(false)
  const [providerData, setProviderData] = useState({
    businessName: "", bio: "", city: "", postalCode: "",
    country: "DE", serviceRadiusKm: "25", ecoLevel: "basic",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationValid, setLocationValid] = useState(true)

  function updateProvider(key: keyof typeof providerData, value: string) {
    setProviderData(prev => ({ ...prev, [key]: value }))
  }

  const providerValid = providerData.businessName.trim().length >= 2
    && providerData.bio.trim().length >= 20
    && providerData.city.trim().length >= 2
    && providerData.postalCode.trim().length >= 3
    && locationValid

  const isValid = !!role && firstName.trim().length > 0 && lastName.trim().length > 0 && gdpr
    && (role !== "provider" || providerValid)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setLoading(true)
    setError(null)
    try {
      const body = role === "provider"
        ? { role, firstName, lastName, phone, gdprConsent: true, ...providerData, serviceRadiusKm: parseInt(providerData.serviceRadiusKm) || 25 }
        : { role, firstName, lastName, phone, gdprConsent: true }

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? t("genericError"))
        return
      }
      window.location.href = (data as { redirect?: string }).redirect ?? "/dashboard"
    } catch {
      setError(t("networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-serif font-bold text-[#2B3441] mb-1">{t("heading")}</h1>
        <p className="text-[#6B7280] text-sm">{t("subheading")}</p>
      </div>

      <div className="space-y-3">
        {ROLE_CARDS.map(({ value, icon: Icon, titleKey, descKey }) => (
          <button type="button" key={value} onClick={() => setRole(value)}
            className={cn(
              "w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all",
              role === value ? "border-[#2D7A5F] bg-[#F4FAF6]" : "border-[#E5EDE9] bg-white hover:border-[#2D7A5F]/40"
            )}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              role === value ? "bg-[#2D7A5F]" : "bg-[#EDF5F0]")}>
              <Icon className={cn("w-5 h-5", role === value ? "text-white" : "text-[#2D7A5F]")} />
            </div>
            <div>
              <p className="font-semibold text-[#2B3441] mb-0.5">{t(titleKey)}</p>
              <p className="text-sm text-[#6B7280] leading-snug">{t(descKey)}</p>
            </div>
            {role === value && (
              <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-[#2D7A5F] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5EDE9] shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("firstNameLabel")}</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t("firstNamePlaceholder")} required />
          </div>
          <div>
            <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">{t("lastNameLabel")}</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t("lastNamePlaceholder")} required />
          </div>
        </div>

        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">
            {t("phoneLabel")} <span className="text-[#6B7280] font-normal">{t("phoneOptional")}</span>
          </Label>
          <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 12345678" />
        </div>

        {role === "provider" && <ProviderFields values={providerData} onChange={updateProvider} onValidChange={setLocationValid} />}

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={gdpr} onChange={e => setGdpr(e.target.checked)}
            className="mt-0.5 rounded accent-[#2D7A5F]" />
          <span className="text-xs text-[#6B7280] leading-relaxed">
            {t.rich("gdprConsent", {
              terms: (chunks) => (
                <a href="/legal/terms" target="_blank" className="text-[#2D7A5F] underline">{chunks}</a>
              ),
              privacy: (chunks) => (
                <a href="/legal/privacy" target="_blank" className="text-[#2D7A5F] underline">{chunks}</a>
              ),
            })}
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" disabled={!isValid || loading}
        className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-12 text-base">
        {loading ? t("submitLoading") : role === "provider" ? t("submitProvider") : role === "affiliate" ? t("submitAffiliate") : t("submitCustomer")}
      </Button>
    </form>
  )
}
