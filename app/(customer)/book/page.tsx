"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

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
  const { setCategory, categoryId } = useBookingStore()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  useEffect(() => {
    if (categoryId) setSelectedSlug(categoryId)
  }, [categoryId])

  function handleSelect(slug: string, name: string) {
    setSelectedSlug(slug)
    setCategory(slug, name)
  }

  function handleNext() {
    if (!selectedSlug) return
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleSelect(cat.slug, cat.name)}
              className={cn(
                "bg-white rounded-2xl p-4 text-left border-2 transition-all hover:shadow-md hover:border-[#4CB87A]",
                selectedSlug === cat.slug
                  ? "border-[#2D7A5F] shadow-md bg-[#F4FAF6]"
                  : "border-transparent shadow-sm"
              )}
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <p className="font-semibold text-[#2B3441] text-sm leading-tight">{t(`category_${cat.id}_name`)}</p>
              <p className="text-xs text-[#6B7280] mt-1 leading-tight">{t(`category_${cat.id}_desc`)}</p>
              <p className="text-xs font-bold text-[#2D7A5F] mt-2">{t("fromPrice", { price: cat.from })}</p>
            </button>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedSlug}
          className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-base"
        >
          {t("continueButton")}
        </Button>
      </div>
    </div>
  )
}
