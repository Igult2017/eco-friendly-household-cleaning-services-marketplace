"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, MapPin, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import { usePostalValidation } from "@/hooks/usePostalValidation"
import type { GeoResult } from "@/lib/nominatim"
import { geocodeFlexible, extractPostalCode } from "@/lib/nominatim"
import { CountryField } from "@/components/location/CountryField"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { localTodayYmd } from "@/lib/utils/formatDate"
import { SaveCardPrompt } from "@/components/customer/SaveCardPrompt"

const ECO_OPTIONS = ["Eco-certified products only", "No single-use plastics", "Fragrance-free", "Energy-saving methods"]
const ECO_OPTION_KEYS: Record<string, string> = {
  "Eco-certified products only": "ecoOptionCertified",
  "No single-use plastics": "ecoOptionNoPlastics",
  "Fragrance-free": "ecoOptionFragranceFree",
  "Energy-saving methods": "ecoOptionEnergySaving",
}

// Renders directly under the input it belongs to, instead of one generic banner at the bottom of
// the form — so a mistake is obvious at the field that caused it.
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

export default function PostJobPage() {
  const t = useTranslations("customerPostjobPage")
  const locale = useLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Per-field messages so a mistake shows up right under the box that caused it, instead of one
  // generic banner the user has to hunt for the cause of. `error` stays for page-level failures
  // (network, or anything the server flags that doesn't map to a specific input below).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [locationValid, setLocationValid] = useState(true)
  // Payment method is now part of creating the order itself (both job types), not a follow-up
  // ask after posting — dismissing it here just hides the card, no navigation needed mid-form.
  const [cardPromptDismissed, setCardPromptDismissed] = useState(false)
  const postal = usePostalValidation()
  // Marketing copy, not conditional on picking recurring — shown upfront so it can actually
  // influence the choice, same treatment as the direct-booking wizard's banner.
  const [recurringDiscountPct, setRecurringDiscountPct] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/settings/recurring-discount")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.pct === "number") setRecurringDiscountPct(d.pct) })
      .catch(() => {})
  }, [])

  // "take_job" = emergency instant-assignment (no bidding, first eligible cleaner to claim it is
  // assigned immediately) — a completely separate flow from normal jobs, selected up front.
  const [jobType, setJobType] = useState<"standard" | "take_job">("standard")

  const [form, setForm] = useState({
    title: "",
    description: "",
    hourlyRate: "",
    desiredDate: "",
    desiredTimeStart: "",
    desiredTimeEnd: "",
    estimatedHours: "2",
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

  // Tracked so handleSubmit can wait on a blur-triggered lookup that's still in flight, instead of
  // reading `form.serviceLatitude` before it's resolved (the cause of "missing address" firing even
  // when both fields were filled in, working again on a retry).
  const geocodePromiseRef = useRef<Promise<{ lat: number; lng: number } | null> | null>(null)

  async function geocodeAddress() {
    if (!form.serviceAddress.city || !form.serviceAddress.postalCode) return null
    setGeocoding(true)
    const promise = (async () => {
      try {
        const geo = await geocodeFlexible(form.serviceAddress)
        if (!geo) return null
        setForm((prev) => ({ ...prev, serviceLatitude: geo.lat, serviceLongitude: geo.lng }))
        return { lat: geo.lat, lng: geo.lng }
      } finally {
        setGeocoding(false)
      }
    })()
    geocodePromiseRef.current = promise
    return promise
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

  // Maps the API's Zod field-error paths (e.g. "serviceAddress.city") onto the local keys the form
  // actually renders error text under — so a server-side catch shows up in the same place a
  // client-side one would, rather than everything getting flattened into one banner.
  function mapFieldErrorPath(path: string): string | null {
    if (path.startsWith("serviceAddress.")) return "location"
    if (path === "desiredTimeRange" || path.startsWith("desiredTimeRange.")) return "desiredTimeRange"
    if (path === "budgetMin" || path === "budgetMax") return "hourlyRate"
    if (path === "estimatedHours") return "estimatedHours"
    if (path === "title") return "title"
    if (path === "description") return "description"
    return null
  }

  function applyErrorResponse(payload: unknown) {
    if (typeof payload === "string") { setError(payload); return }
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>
      const formErrs = Array.isArray(p.formErrors) ? (p.formErrors as string[]) : []
      if (p.fieldErrors && typeof p.fieldErrors === "object") {
        const mapped: Record<string, string> = {}
        const unmapped: string[] = []
        for (const [path, messages] of Object.entries(p.fieldErrors as Record<string, string[]>)) {
          const msg = messages[0]
          if (!msg) continue
          const key = mapFieldErrorPath(path)
          if (key) mapped[key] = msg
          else unmapped.push(msg)
        }
        setFieldErrors(mapped)
        const rest = [...formErrs, ...unmapped].filter(Boolean)
        setError(rest.length ? rest.join(" · ") : null)
        return
      }
      if (formErrs.length) { setError(formErrs.filter(Boolean).join(" · ")); return }
    }
    setError(t("errorGeneric"))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setError(null)
    // Resolve location before checking: a blur-triggered lookup may still be in flight, or (e.g.
    // autofill without a blur event) may never have fired at all. Don't trust `form.serviceLatitude`
    // directly here — setForm from geocodeAddress() won't be reflected in this closure until the next
    // render, so use the resolved value from the promise itself.
    let lat = form.serviceLatitude
    let lng = form.serviceLongitude
    if (!lat) {
      const geo = await (geocodePromiseRef.current ?? geocodeAddress())
      if (geo) { lat = geo.lat; lng = geo.lng }
    }
    if (!lat) { setFieldErrors({ location: t("errorMissingLocation") }); return }
    // Time window (standard jobs only — Take Job has no date/time picker, it's ASAP): both ends or
    // neither, and end must be after start.
    const hasStart = jobType === "standard" && !!form.desiredTimeStart
    const hasEnd = jobType === "standard" && !!form.desiredTimeEnd
    if (hasStart !== hasEnd || (hasStart && hasEnd && form.desiredTimeEnd <= form.desiredTimeStart)) {
      setFieldErrors({ desiredTimeRange: t("errorTimeRange") }); return
    }
    // Budget is entered PER HOUR (the payment mode in EU + US); the stored budget is the job total
    // (rate × estimated hours) — what cleaners actually bid against (or, for Take Job, the final
    // fixed price the claiming cleaner accepts as-is).
    // Per-hour amount is MANDATORY — cleaners bid against it, and it powers the ≈/h display.
    if (!form.hourlyRate || !(parseFloat(form.hourlyRate) > 0)) { setFieldErrors({ hourlyRate: t("errorRateRequired") }); return }
    const hrs = parseFloat(form.estimatedHours)
    if (!(hrs > 0)) { setFieldErrors({ estimatedHours: t("errorHoursRequired") }); return }
    setLoading(true)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          jobType,
          serviceLatitude: lat,
          serviceLongitude: lng,
          // Normalize messy postal input ("12047 Neukölln" → "12047") — API caps postal at 10 chars.
          serviceAddress: { ...form.serviceAddress, postalCode: extractPostalCode(form.serviceAddress.postalCode) },
          // Single hourly rate → one job total, stored in both bounds (boards collapse equal values).
          budgetMin: form.hourlyRate ? Math.round(parseFloat(form.hourlyRate) * 100 * hrs) : undefined,
          budgetMax: form.hourlyRate ? Math.round(parseFloat(form.hourlyRate) * 100 * hrs) : undefined,
          desiredDate: jobType === "standard" ? form.desiredDate : undefined,
          desiredTimeRange: hasStart && hasEnd ? { start: form.desiredTimeStart, end: form.desiredTimeEnd } : undefined,
          estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
          recurringFrequency: jobType === "standard" ? (form.recurringFrequency || undefined) : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        applyErrorResponse(d.error)
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
        <p className="text-[#6B7280] text-center mb-6 max-w-sm">{t("successDescription")}</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/jobs")} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">{t("viewMyJobs")}</Button>
          <Button variant="outline" onClick={() => { setSuccess(false); setJobType("standard"); setForm({ title: "", description: "", hourlyRate: "", desiredDate: "", desiredTimeStart: "", desiredTimeEnd: "", estimatedHours: "2", serviceAddress: { line1: "", city: "", postalCode: "", country: "DE" }, serviceLatitude: 0, serviceLongitude: 0, radiusKm: 25, ecoRequirements: [], recurringFrequency: "" }) }} className="border-[#E5EBF0]">{t("postAnother")}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">{t("pageTitle")}</h1>
        <p className="text-[#6B7280] mb-6">{t("pageSubtitle")}</p>

        {/* Take Job is a fully separate flow from normal bidding — chosen up front, not a checkbox
            buried in the form. Selecting it hides scheduling/recurring fields that don't apply. */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setJobType("standard")}
            className={cn(
              "rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all text-left",
              jobType === "standard" ? "border-[#2D7A5F] bg-[#F4FAF6] text-[#2B3441]" : "border-[#E5EBF0] text-[#6B7280] hover:border-[#4CB87A]"
            )}
          >
            {t("modeStandardTitle")}
            <p className="text-xs font-normal mt-0.5 opacity-80">{t("modeStandardHint")}</p>
          </button>
          <button
            type="button"
            onClick={() => setJobType("take_job")}
            className={cn(
              "rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all text-left",
              jobType === "take_job" ? "border-red-500 bg-red-50 text-red-700" : "border-[#E5EBF0] text-[#6B7280] hover:border-red-300"
            )}
          >
            🚨 {t("modeTakeJobTitle")}
            <p className="text-xs font-normal mt-0.5 opacity-80">{t("modeTakeJobHint")}</p>
          </button>
        </div>
        {jobType === "take_job" && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {t("takeJobExplainer")}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-4">
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("jobTitleLabel")}</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("jobTitlePlaceholder")} required minLength={5}
                className={cn(fieldErrors.title && "border-red-400 ring-1 ring-red-400")} />
              <FieldError msg={fieldErrors.title} />
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("descriptionLabel")}</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("descriptionPlaceholder")} rows={4} required minLength={20}
                className={cn("resize-none", fieldErrors.description && "border-red-400 ring-1 ring-red-400")} />
              <FieldError msg={fieldErrors.description} />
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("hourlyRateLabel")}</Label>
              <Input type="number" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} placeholder="25" min={1} step="0.5" required
                className={cn(fieldErrors.hourlyRate && "border-red-400 ring-1 ring-red-400")} />
              {form.hourlyRate && parseFloat(form.estimatedHours) > 0 && (
                <p className="text-xs text-[#2D7A5F] font-medium mt-1">
                  {t("budgetTotalHint", {
                    hours: form.estimatedHours,
                    total: formatCurrencyForCountry(Math.round((parseFloat(form.hourlyRate) || 0) * 100 * parseFloat(form.estimatedHours)), form.serviceAddress.country),
                  })}
                </p>
              )}
              <FieldError msg={fieldErrors.hourlyRate} />
            </div>
            {jobType === "standard" && (
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("desiredDateLabel")}</Label>
                <Input type="date" value={form.desiredDate} onChange={(e) => set("desiredDate", e.target.value)} min={localTodayYmd()} />
                {form.desiredDate && (
                  // Day of week derives from the date — surface it so the poster sees which day this is.
                  <p className="text-xs text-[#2D7A5F] font-medium mt-1">
                    {new Date(form.desiredDate + "T12:00:00").toLocaleDateString(locale, { weekday: "long" })}
                  </p>
                )}
              </div>
            )}
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("estimatedHoursLabel")}</Label>
              <Input type="number" min={0.5} max={12} step={0.5} value={form.estimatedHours} onChange={(e) => set("estimatedHours", e.target.value)} required
                className={cn(fieldErrors.estimatedHours && "border-red-400 ring-1 ring-red-400")} />
              <p className="text-xs text-[#9CA3AF] mt-1">{t("estimatedHoursHint")}</p>
              <FieldError msg={fieldErrors.estimatedHours} />
            </div>
            {jobType === "standard" && (
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("timeWindowLabel")}</Label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={form.desiredTimeStart} onChange={(e) => set("desiredTimeStart", e.target.value)}
                    className={cn("flex-1", fieldErrors.desiredTimeRange && "border-red-400 ring-1 ring-red-400")} />
                  <span className="text-[#9CA3AF]">–</span>
                  <Input type="time" value={form.desiredTimeEnd} onChange={(e) => set("desiredTimeEnd", e.target.value)}
                    className={cn("flex-1", fieldErrors.desiredTimeRange && "border-red-400 ring-1 ring-red-400")} />
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1">{t("timeWindowHint")}</p>
                <FieldError msg={fieldErrors.desiredTimeRange} />
              </div>
            )}
            {recurringDiscountPct !== null && recurringDiscountPct > 0 && (
              <div className="rounded-xl bg-[#F4FAF6] border border-[#2D7A5F]/20 px-4 py-3 text-sm text-[#2D7A5F]">
                {/* Take Job can't itself be recurring (it's a same-day, one-off request) — this is
                    cross-promoting the separate recurring option, not offering to make THIS job recurring. */}
                {jobType === "standard"
                  ? t("recurringBenefitBanner", { pct: recurringDiscountPct })
                  : t("recurringBenefitBannerTakeJob", { pct: recurringDiscountPct })}
              </div>
            )}
            {jobType === "standard" && (
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">{t("recurringLabel")}</Label>
                <select value={form.recurringFrequency} onChange={(e) => set("recurringFrequency", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#E5EBF0] bg-white px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]">
                  <option value="">{t("recurring_none")}</option>
                  <option value="recurring">{t("recurring_recurring")}</option>
                </select>
                <p className="text-xs text-[#9CA3AF] mt-1">{t("recurringHint")}</p>
              </div>
            )}
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
                  onBlur={() => { geocodeAddress(); validatePostal() }}
                  className={cn(fieldErrors.location && "border-red-400 ring-1 ring-red-400")} />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("postalCodeLabel")}</Label>
                <Input value={form.serviceAddress.postalCode}
                  onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, postalCode: e.target.value } }))}
                  placeholder="10115" required
                  onBlur={() => { geocodeAddress(); validatePostal() }}
                  className={cn(fieldErrors.location && "border-red-400 ring-1 ring-red-400")} />
              </div>
            </div>
            {/* Composite error — city + postal are checked together, so the message sits right below
                both rather than pointing at just one of the two. */}
            <FieldError msg={fieldErrors.location} />
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("countryLabel")}</Label>
              <CountryField
                id="postjob-country"
                code={form.serviceAddress.country}
                onCode={(c) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, country: c } }))}
                invalidText={t("countryInvalid")}
              />
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
              {jobType === "take_job" && <p className="text-xs text-red-600 font-medium mt-1">{t("radiusTakeJobHint")}</p>}
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

          {/* Payment method is part of placing the order itself, for both standard and Take Job
              posts — not a follow-up ask after the job already exists. */}
          {!cardPromptDismissed && (
            <div className="flex justify-center">
              <SaveCardPrompt onSkip={() => setCardPromptDismissed(true)} skipLabel={t("continueWithoutCard")} />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !locationValid}
            className={cn("w-full h-12 font-semibold text-white", jobType === "take_job" ? "bg-red-600 hover:bg-red-700" : "bg-[#2D7A5F] hover:bg-[#235f49]")}
          >
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> {t("posting")}</> : jobType === "take_job" ? t("submitButtonTakeJob") : t("submitButton")}
          </Button>
        </form>
      </div>
    </div>
  )
}
