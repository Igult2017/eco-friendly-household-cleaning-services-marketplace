"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { UserCheck, X } from "lucide-react"

const SERVICE_CATEGORIES = [
  { id: "regular", slug: "regular-cleaning", icon: "🌿", name: "Regular Cleaning", from: "€29" },
  { id: "deep", slug: "deep-cleaning", icon: "🏠", name: "Deep Cleaning", from: "€79" },
  { id: "move", slug: "move-in-out", icon: "📦", name: "Move-in / Move-out", from: "€99" },
  { id: "office", slug: "office-cleaning", icon: "🏢", name: "Office Cleaning", from: "€49" },
  { id: "laundry", slug: "laundry", icon: "👕", name: "Laundry Service", from: "€19" },
  { id: "windows", slug: "window-cleaning", icon: "🪟", name: "Window Cleaning", from: "€39" },
]

export default function BookStep1Page() {
  const t = useTranslations("customerBookPage")
  const router = useRouter()
  const { setCategory, categoryId, providerPreselected, providerName, selectedProviderId, setPreselectedProvider, clearPreselection } = useBookingStore()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  // null = no preselection constraint (normal flow); array = only these slugs are bookable.
  const [offeredSlugs, setOfferedSlugs] = useState<string[] | null>(null)

  useEffect(() => {
    if (categoryId) setSelectedSlug(categoryId)
  }, [categoryId])

  // Pre-selected cleaner (Book button on browse/profile passes ?providerId=…, or one is already in the
  // store). Fetch their summary → banner name + which services they offer; the search step is skipped.
  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("providerId")
    const targetId = urlId ?? (providerPreselected ? selectedProviderId : null)
    if (!targetId) { setOfferedSlugs(null); return }
    let cancelled = false
    fetch(`/api/providers/${targetId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (!d) { if (urlId) clearPreselection(); setOfferedSlugs(null); return }
        setPreselectedProvider(d.id, d.businessName, d.country ?? null)
        setOfferedSlugs(d.categorySlugs ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isOffered = (slug: string) => offeredSlugs === null || offeredSlugs.includes(slug)

  function handleSelect(slug: string, name: string) {
    if (!isOffered(slug)) return
    setSelectedSlug(slug)
    setCategory(slug, name)
  }

  function handleNext() {
    if (!selectedSlug || !isOffered(selectedSlug)) return
    router.push("/book/providers")
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={1} />

      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">
          {t("heading")}
        </h1>
        <p className="text-center text-[#6B7280] mb-8">{t("subheading")}</p>

        {providerPreselected && providerName && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#2D7A5F]/25 bg-[#EDF5F0] px-4 py-3">
            <UserCheck size={18} className="shrink-0 text-[#2D7A5F]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#2B3441]">{t("preBannerTitle", { name: providerName })}</p>
              <p className="text-xs text-[#6B7280]">{t("preBannerHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => { clearPreselection(); setOfferedSlugs(null) }}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#2B3441] transition-colors"
              aria-label={t("changeCleaner")}
            >
              <X size={13} /> {t("changeCleaner")}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {SERVICE_CATEGORIES.map((cat) => {
            const offered = isOffered(cat.slug)
            return (
            <button
              key={cat.slug}
              onClick={() => handleSelect(cat.slug, cat.name)}
              disabled={!offered}
              className={cn(
                "bg-white rounded-2xl p-4 text-left border-2 transition-all",
                offered ? "hover:shadow-md hover:border-[#4CB87A]" : "opacity-45 cursor-not-allowed",
                selectedSlug === cat.slug && offered
                  ? "border-[#2D7A5F] shadow-md bg-[#F4FAF6]"
                  : "border-transparent shadow-sm"
              )}
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <p className="font-semibold text-[#2B3441] text-sm leading-tight">{t(`category_${cat.id}_name`)}</p>
              <p className="text-xs text-[#6B7280] mt-1 leading-tight">{t(`category_${cat.id}_desc`)}</p>
              <p className="text-xs font-bold text-[#2D7A5F] mt-2">
                {offered ? t("fromPrice", { price: cat.from }) : t("notOfferedBadge")}
              </p>
            </button>
            )
          })}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedSlug || !isOffered(selectedSlug)}
          className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-base"
        >
          {t("continueButton")}
        </Button>
      </div>
    </div>
  )
}
