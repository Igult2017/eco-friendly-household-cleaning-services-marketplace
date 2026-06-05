"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const ECO_EXTRAS = [
  { id: "eco_products", label: "🌿 Eco-certified products only", desc: "Biodegradable, plant-based cleaning agents" },
  { id: "no_plastic", label: "♻️ No single-use plastics", desc: "Reusable cloths and containers" },
  { id: "energy_saving", label: "⚡ Energy-saving methods", desc: "Cold water wash, minimal appliance use" },
  { id: "fragrance_free", label: "🌸 Fragrance-free", desc: "Unscented products for sensitive households" },
]

export default function BookStep4Page() {
  const router = useRouter()
  const { selectedProviderId, scheduledAt, setExtras, specialInstructions, ecoOptions } = useBookingStore()

  const [instructions, setInstructions] = useState(specialInstructions)
  const [selected, setSelected] = useState<string[]>(ecoOptions)

  useEffect(() => {
    if (!selectedProviderId || !scheduledAt) { router.replace("/book"); return }
  }, [selectedProviderId, scheduledAt, router])

  function toggleEco(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function handleNext() {
    setExtras(instructions, selected)
    router.push("/book/confirm")
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={4} />

      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">
          Any special requests?
        </h1>
        <p className="text-center text-[#6B7280] mb-8">Help your cleaner prepare for the perfect visit</p>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
          <Label className="text-sm font-semibold text-[#2B3441] mb-2 block">Special instructions</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Please focus on the kitchen and bathrooms. The dog is friendly but may bark. Key is under the mat."
            rows={4}
            maxLength={1000}
            className="resize-none"
          />
          <p className="text-xs text-[#9CA3AF] mt-1">{instructions.length} / 1000</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <Label className="text-sm font-semibold text-[#2B3441] mb-1 block">Eco preferences</Label>
          <p className="text-xs text-[#6B7280] mb-4">Select any preferences for your cleaning session</p>
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
                  <p className="text-sm font-medium text-[#2B3441]">{opt.label}</p>
                  <p className="text-xs text-[#6B7280]">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/book/schedule")} className="flex-1 h-11 border-[#E5EBF0]">
            ← Back
          </Button>
          <Button onClick={handleNext} className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white">
            Continue — Review & Pay →
          </Button>
        </div>
      </div>
    </div>
  )
}
