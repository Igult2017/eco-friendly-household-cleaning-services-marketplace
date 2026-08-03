"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { UserCheck, X, Sparkles } from "lucide-react"
import { FieldError } from "@/components/ui/FieldError"

const SERVICE_CATEGORIES = [
  { id: "regular", slug: "regular-cleaning", icon: "🌿", name: "Regular Cleaning", from: "€29" },
  { id: "deep", slug: "deep-cleaning", icon: "🏠", name: "Deep Cleaning", from: "€79" },
  // Slug MUST match the DB category ("move-cleaning" — see seed + ensure script); "move-in-out"
  // matched nothing, so Move bookings could never resolve a service.
  { id: "move", slug: "move-cleaning", icon: "📦", name: "Move-in / Move-out", from: "€99" },
  { id: "office", slug: "office-cleaning", icon: "🏢", name: "Office Cleaning", from: "€49" },
  { id: "laundry", slug: "laundry", icon: "👕", name: "Laundry Service", from: "€19" },
  { id: "windows", slug: "window-cleaning", icon: "🪟", name: "Window Cleaning", from: "€39" },
]

const FREQUENCY_OPTIONS = ["one_time", "weekly", "biweekly", "monthly"] as const
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

export default function BookStep1Page() {
  const t = useTranslations("customerBookPage")
  const tSchedule = useTranslations("customerBookSchedulePage")
  const router = useRouter()
  const {
    setCategory, categoryId, providerPreselected, providerName, selectedProviderId, setPreselectedProvider, clearPreselection,
    frequency, setFrequency, recurringDays, setRecurringDays, cleaningTypeNote, setCleaningTypeNote,
  } = useBookingStore()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  // While the pre-selected cleaner's summary fetch is in flight, hold Continue until it resolves.
  const [preLoading, setPreLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // Marketing copy shown BEFORE any click — the discount rate is fetched but the banner itself
  // doesn't wait on it to be worth showing; only the number is conditional.
  const [discountPct, setDiscountPct] = useState<number | null>(null)

  useEffect(() => {
    if (categoryId) setSelectedSlug(categoryId)
  }, [categoryId])

  useEffect(() => {
    fetch("/api/settings/recurring-discount")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.pct) setDiscountPct(d.pct) })
      .catch(() => {})
  }, [])

  // Pre-selected cleaner (Book button on browse/profile passes ?providerId=…, or one is already in the
  // store). Fetch their summary → banner name; the search step is skipped. Category selection is
  // never gated by what this cleaner has listed (see isOffered below), so the summary's
  // categorySlugs are no longer consulted here.
  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("providerId")
    const targetId = urlId ?? (providerPreselected ? selectedProviderId : null)
    if (!targetId) return
    let cancelled = false
    setPreLoading(true)
    fetch(`/api/providers/${targetId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (!d) { if (urlId) clearPreselection(); return }
        setPreselectedProvider(d.id, d.businessName, d.country ?? null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Categories are never gated by what a specific cleaner has explicitly listed — a client can pick
  // any type of cleaning for any chosen cleaner. Pricing still resolves to a real service (the
  // services API falls back to the cleaner's other active services when none match the picked
  // category — see app/api/providers/[id]/services/route.ts), and the manual note below covers
  // anything the fixed categories don't capture.
  const isOffered = (_slug: string) => true

  function handleSelect(slug: string, name: string) {
    if (!isOffered(slug)) return
    setSelectedSlug(slug)
    setCategory(slug, name)
    if (fieldErrors.category) setFieldErrors({})
  }

  // Multi-day selection — each picked weekday becomes its own independent recurring schedule
  // (see maybeSetupRecurringSchedule in book/confirm/page.tsx), so "weekly, Tue + Thu" means cleaned
  // twice a week. The welcome-discount cap is enforced once per client-cleaner relationship, not per
  // day (lib/inngest/functions/recurring.ts), so picking more days doesn't multiply the discount.
  function toggleDay(d: number) {
    setRecurringDays(
      recurringDays.includes(d) ? recurringDays.filter((x) => x !== d) : [...recurringDays, d].sort((a, b) => a - b)
    )
  }

  function handleNext() {
    if (!selectedSlug || !isOffered(selectedSlug)) {
      setFieldErrors({ category: t("errorSelectCategory") })
      return
    }
    router.push("/book/providers")
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={1} />

      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">
          {t("heading")}
        </h1>
        <p className="text-center text-[#6B7280] mb-6">{t("subheading")}</p>

        {/* Recurring discount — shown unconditionally, before the client has picked anything, since
            this is meant to sell the option rather than just confirm a choice already made. */}
        {discountPct !== null && discountPct > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#2D7A5F]/25 bg-gradient-to-br from-[#EDF5F0] to-[#F4FAF6] px-4 py-3.5">
            <Sparkles size={18} className="shrink-0 text-[#2D7A5F] mt-0.5" />
            <p className="text-sm text-[#2B3441] leading-relaxed">
              {t("recurringBenefitBanner", { pct: discountPct })}
            </p>
          </div>
        )}

        {/* Frequency — the first DECISION on the page, ahead of what service/cleaner is picked. */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <Label className="text-sm font-semibold text-[#2B3441] mb-1 block">{tSchedule("frequencyLabel")}</Label>
          <p className="text-xs text-[#6B7280] mb-3">{tSchedule("frequencyHint")}</p>
          <div className="flex flex-wrap gap-2">
            {FREQUENCY_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all",
                  frequency === f
                    ? "border-[#2D7A5F] bg-[#2D7A5F] text-white"
                    : "border-[#E5EBF0] hover:border-[#4CB87A] text-[#2B3441]"
                )}
              >
                {tSchedule(`freq_${f}`)}
              </button>
            ))}
          </div>

          {frequency !== "one_time" && (
            <div className="mt-4 border-t border-[#E5EBF0] pt-4">
              <Label className="text-sm font-semibold text-[#2B3441] mb-1 block">{tSchedule("recurringDaysLabel")}</Label>
              <p className="text-xs text-[#6B7280] mb-3">{tSchedule("recurringDaysHint")}</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all",
                      recurringDays.includes(d)
                        ? "border-[#2D7A5F] bg-[#2D7A5F] text-white"
                        : "border-[#E5EBF0] hover:border-[#4CB87A] text-[#2B3441]"
                    )}
                  >
                    {/* 2024-01-07 is a Sunday — offset by d for a locale-aware weekday name. */}
                    {new Date(Date.UTC(2024, 0, 7 + d)).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {providerPreselected && providerName && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#2D7A5F]/25 bg-[#EDF5F0] px-4 py-3">
            <UserCheck size={18} className="shrink-0 text-[#2D7A5F]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#2B3441]">{t("preBannerTitle", { name: providerName })}</p>
              <p className="text-xs text-[#6B7280]">{t("preBannerHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => clearPreselection()}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#2B3441] transition-colors"
              aria-label={t("changeCleaner")}
            >
              <X size={13} /> {t("changeCleaner")}
            </button>
          </div>
        )}

        <div
          className={cn(
            "grid grid-cols-2 sm:grid-cols-3 gap-3 mb-1 rounded-2xl",
            fieldErrors.category && "ring-1 ring-red-400"
          )}
        >
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleSelect(cat.slug, cat.name)}
              className={cn(
                "bg-white rounded-2xl p-4 text-left border-2 transition-all hover:shadow-md hover:border-[#4CB87A]",
                selectedSlug === cat.slug ? "border-[#2D7A5F] shadow-md bg-[#F4FAF6]" : "border-transparent shadow-sm"
              )}
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <p className="font-semibold text-[#2B3441] text-sm leading-tight">{t(`category_${cat.id}_name`)}</p>
              <p className="text-xs text-[#6B7280] mt-1 leading-tight">{t(`category_${cat.id}_desc`)}</p>
              <p className="text-xs font-bold text-[#2D7A5F] mt-2">{t("fromPrice", { price: cat.from })}</p>
            </button>
          ))}
        </div>
        <div className="mb-8">
          <FieldError msg={fieldErrors.category} />
        </div>

        {/* Manual note — supplements the category cards; doesn't replace them. Feeds into
            specialInstructions alongside the extras step's own note (book/confirm/page.tsx merges
            both, neither overwrites the other). */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-8">
          <Label className="text-sm font-semibold text-[#2B3441] mb-1 block">{t("cleaningTypeNoteLabel")}</Label>
          <p className="text-xs text-[#6B7280] mb-3">{t("cleaningTypeNoteHint")}</p>
          <Textarea
            value={cleaningTypeNote}
            onChange={(e) => setCleaningTypeNote(e.target.value)}
            placeholder={t("cleaningTypeNotePlaceholder")}
            rows={3}
            className="resize-none"
          />
        </div>

        <Button
          onClick={handleNext}
          disabled={preLoading}
          className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-base"
        >
          {t("continueButton")}
        </Button>
      </div>
    </div>
  )
}
