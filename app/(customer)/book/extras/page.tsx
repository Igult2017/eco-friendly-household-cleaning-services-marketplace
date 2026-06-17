"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { formatCurrency } from "@/lib/utils/formatCurrency"

type Addon = { id: string; name: string; priceCents: number }

const ECO_EXTRAS = [
  { id: "eco_products", labelKey: "ecoProductsLabel", descKey: "ecoProductsDesc" },
  { id: "no_plastic", labelKey: "noPlasticLabel", descKey: "noPlasticDesc" },
  { id: "energy_saving", labelKey: "energySavingLabel", descKey: "energySavingDesc" },
  { id: "fragrance_free", labelKey: "fragranceFreeLabel", descKey: "fragranceFreeDesc" },
] as const

export default function BookStep4Page() {
  const t = useTranslations("customerBookExtrasPage")
  const router = useRouter()
  const { selectedProviderId, scheduledAt, setExtras, specialInstructions, ecoOptions, addOnIds } = useBookingStore()

  const [instructions, setInstructions] = useState(specialInstructions)
  const [selected, setSelected] = useState<string[]>(ecoOptions)
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(addOnIds)

  useEffect(() => {
    if (!selectedProviderId || !scheduledAt) { router.replace("/book"); return }
    fetch(`/api/providers/${selectedProviderId}/addons`)
      .then((r) => r.json())
      .then((d) => setAddons(Array.isArray(d.addons) ? d.addons : []))
      .catch(() => setAddons([]))
  }, [selectedProviderId, scheduledAt, router])

  function toggleEco(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function toggleAddOn(id: string) {
    setSelectedAddOns((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function handleNext() {
    // Only keep add-ons that still belong to this provider's current list.
    const validAddOns = selectedAddOns.filter((id) => addons.some((a) => a.id === id))
    setExtras(instructions, selected, validAddOns)
    router.push("/book/confirm")
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={4} />

      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">
          {t("heading")}
        </h1>
        <p className="text-center text-[#6B7280] mb-8">{t("subheading")}</p>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
          <Label className="text-sm font-semibold text-[#2B3441] mb-2 block">{t("specialInstructionsLabel")}</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t("specialInstructionsPlaceholder")}
            rows={4}
            maxLength={1000}
            className="resize-none"
          />
          <p className="text-xs text-[#9CA3AF] mt-1">{t("charCount", { count: instructions.length })}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <Label className="text-sm font-semibold text-[#2B3441] mb-1 block">{t("ecoPreferencesLabel")}</Label>
          <p className="text-xs text-[#6B7280] mb-4">{t("ecoPreferencesHint")}</p>
          <div className="space-y-2">
            {ECO_EXTRAS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => toggleEco(opt.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
                  selected.includes(opt.id)
                    ? "border-[#2D7A5F] bg-[#F4FAF6]"
                    : "border-[#E5EBF0] hover:border-[#4CB87A]"
                )}
              >
                <div className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center text-white text-xs transition-all", selected.includes(opt.id) ? "border-[#2D7A5F] bg-[#2D7A5F]" : "border-[#9CA3AF]")}>
                  {selected.includes(opt.id) && "✓"}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2B3441]">{t(opt.labelKey)}</p>
                  <p className="text-xs text-[#6B7280]">{t(opt.descKey)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {addons.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
            <Label className="text-sm font-semibold text-[#2B3441] mb-1 block">{t("addOnsLabel")}</Label>
            <p className="text-xs text-[#6B7280] mb-4">{t("addOnsHint")}</p>
            <div className="space-y-2">
              {addons.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAddOn(a.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 text-left transition-all",
                    selectedAddOns.includes(a.id) ? "border-[#2D7A5F] bg-[#F4FAF6]" : "border-[#E5EBF0] hover:border-[#4CB87A]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-white text-xs transition-all", selectedAddOns.includes(a.id) ? "border-[#2D7A5F] bg-[#2D7A5F]" : "border-[#9CA3AF]")}>
                      {selectedAddOns.includes(a.id) && "✓"}
                    </div>
                    <span className="text-sm font-medium text-[#2B3441]">{a.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#2D7A5F]">+{formatCurrency(a.priceCents)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/book/schedule")} className="flex-1 h-11 border-[#E5EBF0]">
            {t("backButton")}
          </Button>
          <Button onClick={handleNext} className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white">
            {t("continueButton")}
          </Button>
        </div>
      </div>
    </div>
  )
}
