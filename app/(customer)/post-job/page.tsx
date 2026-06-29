"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, MapPin, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import { usePostalValidation } from "@/hooks/usePostalValidation"
import type { GeoResult } from "@/lib/nominatim"

const ECO_OPTIONS = ["Eco-certified products only", "No single-use plastics", "Fragrance-free", "Energy-saving methods"]
const ECO_OPTION_KEYS: Record<string, string> = {
  "Eco-certified products only": "ecoOptionCertified",
  "No single-use plastics": "ecoOptionNoPlastics",
  "Fragrance-free": "ecoOptionFragranceFree",
  "Energy-saving methods": "ecoOptionEnergySaving",
}

export default function PostJobPage() {
  const t = useTranslations("customerPostjobPage")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationValid, setLocationValid] = useState(true)
  const postal = usePostalValidation()

  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    desiredDate: "",
    serviceAddress: { line1: "", city: "", postalCode: "", country: "DE" },
    serviceLatitude: 0,
    serviceLongitude: 0,
    radiusKm: 25,
    ecoRequirements: [] as string[],
    recurringFrequency: "",
  })

  function set(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function geocodeAddress() {
    if (!form.serviceAddress.city || !form.serviceAddress.postalCode) return
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(form.serviceAddress.postalCode)}&city=${encodeURIComponent(form.serviceAddress.city)}&country=${form.serviceAddress.country}&limit=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "DORIXE-marketplace/1.0 (contact: antiperhenryotieno@gmail.com)" } }
      )
      const data = await res.json()
      if (data[0]) {
        setForm((prev) => ({ ...prev, serviceLatitude: parseFloat(data[0].lat), serviceLongitude: parseFloat(data[0].lon) }))
      }
    } finally {
      setGeocoding(false)
    }
  }

  function handleDetect(result: GeoResult) {
    setForm((prev) => ({
      ...prev,
      serviceAddress: { ...prev.serviceAddress, line1: result.line1, city: result.city, postalCode: result.postalCode },
      serviceLatitude: result.lat,
      serviceLongitude: result.lng,
    }))
    postal.clear()
    setLocationValid(true)
  }

  async function validatePostal() {
    const ok = await postal.validate(form.serviceAddress.postalCode, form.serviceAddress.country, form.serviceAddress.city)
    setLocationValid(ok)
  }

  function toggleEco(opt: string) {
    setForm((prev) => ({
      ...prev,
      ecoRequirements: prev.ecoRequirements.includes(opt) ? prev.ecoRequirements.filter((x) => x !== opt) : [...prev.ecoRequirements, opt],
    }))
  }

  function extractError(payload: unknown): string {
    if (typeof payload === "string") return payload
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>
      const formErrs = Array.isArray(p.formErrors) ? p.formErrors : []
      const fieldErrs = p.fieldErrors && typeof p.fieldErrors === "object"
        ? Object.values(p.fieldErrors as Record<string, string[]>).flat()
        : []
      const all = [...formErrs, ...fieldErrs].filter(Boolean)
      if (all.length) return all.join(" · ")
    }
    return t("errorGeneric")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.serviceLatitude) { setError(t("errorMissingLocation")); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budgetMin: form.budgetMin ? parseInt(form.budgetMin) * 100 : undefined,
          budgetMax: form.budgetMax ? parseInt(form.budgetMax) * 100 : undefined,
          recurringFrequency: form.recurringFrequency || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(extractError(d.error))
        return
      }
      setSuccess(true)
    } catch {
      setError(t("errorNetwork"))
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] flex flex-col items-center justify-center px-4 py-20">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] text-center mb-2">{t("successTitle")}</h1>
        <p className="text-[#6B7280] text-center mb-8 max-w-sm">{t("successDescription")}</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/jobs")} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">{t("viewMyJobs")}</Button>
          <Button variant="outline" onClick={() => { setSuccess(false); setForm({ title: "", description: "", budgetMin: "", budgetMax: "", desiredDate: "", serviceAddress: { line1: "", city: "", postalCode: "", country: "DE" }, serviceLatitude: 0, serviceLongitude: 0, radiusKm: 25, ecoRequirements: [], recurringFrequency: "" }) }} className="border-[#E5EBF0]">{t("postAnother")}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">{t("pageTitle")}</h1>
        <p className="text-[#6B7280] mb-8">{t("pageSubtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-4">
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("jobTitleLabel")}</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("jobTitlePlaceholder")} required minLength={5} />
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("descriptionLabel")}</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("descriptionPlaceholder")} rows={4} required minLength={20} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("budgetMinLabel")}</Label>
                <Input type="number" value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} placeholder="50" min={1} />
              </div>
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("budgetMaxLabel")}</Label>
                <Input type="number" value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} placeholder="150" min={1} />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("desiredDateLabel")}</Label>
              <Input type="date" value={form.desiredDate} onChange={(e) => set("desiredDate", e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("recurringLabel")}</Label>
              <select value={form.recurringFrequency} onChange={(e) => set("recurringFrequency", e.target.value)}
                className="flex h-10 w-full rounded-md border border-[#E5EBF0] bg-white px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]">
                <option value="">{t("recurring_none")}</option>
                <option value="weekly">{t("recurring_weekly")}</option>
                <option value="biweekly">{t("recurring_biweekly")}</option>
                <option value="monthly">{t("recurring_monthly")}</option>
              </select>
              <p className="text-xs text-[#9CA3AF] mt-1">{t("recurringHint")}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#2B3441]">{t("serviceLocationTitle")}</h2>
              <LocationDetectButton onDetect={handleDetect} />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("streetAddressLabel")}</Label>
              <Input value={form.serviceAddress.line1} onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, line1: e.target.value } }))} placeholder="Hauptstraße 42" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("cityLabel")}</Label>
                <Input value={form.serviceAddress.city}
                  onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, city: e.target.value } }))}
                  placeholder="Berlin" required
                  onBlur={() => { geocodeAddress(); validatePostal() }} />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("postalCodeLabel")}</Label>
                <Input value={form.serviceAddress.postalCode}
                  onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, postalCode: e.target.value } }))}
                  placeholder="10115" required
                  onBlur={() => { geocodeAddress(); validatePostal() }} />
              </div>
            </div>
            {postal.postalError && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span className="flex-1">{postal.postalError}</span>
                {postal.canonicalCity && (
                  <button type="button" onClick={() => { setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, city: postal.canonicalCity! } })); postal.clear(); setLocationValid(true) }}
                    className="shrink-0 font-semibold underline hover:text-amber-900 transition-colors">
                    {t("useCanonicalCity", { city: postal.canonicalCity })}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <MapPin size={13} className={form.serviceLatitude ? "text-[#2D7A5F]" : "text-[#9CA3AF]"} />
              {geocoding ? t("locating") : form.serviceLatitude ? t("located", { lat: form.serviceLatitude.toFixed(4), lng: form.serviceLongitude.toFixed(4) }) : t("locationHint")}
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("radiusLabel", { km: form.radiusKm })}</Label>
              <input type="range" min={5} max={100} value={form.radiusKm} onChange={(e) => set("radiusKm", parseInt(e.target.value))} className="w-full accent-[#2D7A5F]" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5">
            <h2 className="font-semibold text-[#2B3441] mb-3">{t("ecoRequirementsTitle")}</h2>
            <div className="space-y-2">
              {ECO_OPTIONS.map((opt) => (
                <label key={opt} className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", form.ecoRequirements.includes(opt) ? "border-[#2D7A5F] bg-[#F4FAF6]" : "border-[#E5EBF0] hover:border-[#4CB87A]")}>
                  <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-white text-xs", form.ecoRequirements.includes(opt) ? "border-[#2D7A5F] bg-[#2D7A5F]" : "border-[#9CA3AF]")}>
                    {form.ecoRequirements.includes(opt) && "✓"}
                  </div>
                  <input type="checkbox" className="hidden" checked={form.ecoRequirements.includes(opt)} onChange={() => toggleEco(opt)} />
                  <span className="text-sm text-[#2B3441]">{t(ECO_OPTION_KEYS[opt])}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" disabled={loading || !locationValid} className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold">
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> {t("posting")}</> : t("submitButton")}
          </Button>
        </form>
      </div>
    </div>
  )
}
