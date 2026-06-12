"use client"

import { useState } from "react"
import { Home, Briefcase, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ProviderFields } from "./ProviderFields"

type Role = "customer" | "provider"

const ROLE_CARDS = [
  { value: "customer" as Role, icon: Home, title: "I need cleaning", desc: "Book eco-friendly professionals for your home or office." },
  { value: "provider" as Role, icon: Briefcase, title: "I am a cleaner", desc: "List your eco-certified services and earn on DORIXÉ." },
]

interface Props {
  defaultFirstName?: string
  defaultLastName?: string
}

export function OnboardingForm({ defaultFirstName = "", defaultLastName = "" }: Props) {
  const [role, setRole] = useState<Role | null>(null)
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

  function updateProvider(key: keyof typeof providerData, value: string) {
    setProviderData(prev => ({ ...prev, [key]: value }))
  }

  const providerValid = providerData.businessName.trim().length >= 2
    && providerData.bio.trim().length >= 20
    && providerData.city.trim().length >= 2
    && providerData.postalCode.trim().length >= 3

  const isValid = !!role && firstName.trim().length > 0 && lastName.trim().length > 0 && gdpr
    && (role === "customer" || providerValid)

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
        setError((data as { error?: string }).error ?? "Something went wrong. Please try again.")
        return
      }
      window.location.href = (data as { redirect?: string }).redirect ?? "/dashboard"
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-serif font-bold text-[#2B3441] mb-1">Complete your profile</h1>
        <p className="text-[#6B7280] text-sm">Tell us who you are to get started on DORIXÉ.</p>
      </div>

      <div className="space-y-3">
        {ROLE_CARDS.map(({ value, icon: Icon, title, desc }) => (
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
              <p className="font-semibold text-[#2B3441] mb-0.5">{title}</p>
              <p className="text-sm text-[#6B7280] leading-snug">{desc}</p>
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
            <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">First name *</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jan" required />
          </div>
          <div>
            <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">Last name *</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Müller" required />
          </div>
        </div>

        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">
            Phone <span className="text-[#6B7280] font-normal">(optional)</span>
          </Label>
          <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 12345678" />
        </div>

        {role === "provider" && <ProviderFields values={providerData} onChange={updateProvider} />}

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={gdpr} onChange={e => setGdpr(e.target.checked)}
            className="mt-0.5 rounded accent-[#2D7A5F]" />
          <span className="text-xs text-[#6B7280] leading-relaxed">
            I agree to DORIXÉ&apos;s{" "}
            <a href="/legal/terms" target="_blank" className="text-[#2D7A5F] underline">Terms of Service</a>
            {" "}and{" "}
            <a href="/legal/privacy" target="_blank" className="text-[#2D7A5F] underline">Privacy Policy</a>.
            I consent to processing of my personal data under GDPR.
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
        {loading ? "Setting up your account..." : role === "provider" ? "Join as cleaner →" : "Start booking →"}
      </Button>
    </form>
  )
}
