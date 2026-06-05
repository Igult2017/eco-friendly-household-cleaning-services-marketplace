"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Home, Briefcase, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ROLES = [
  {
    value: "customer" as const,
    icon: Home,
    title: "I need cleaning",
    desc: "Book eco-friendly cleaning professionals for my home or office.",
    color: "#2D7A5F",
  },
  {
    value: "provider" as const,
    icon: Briefcase,
    title: "I am a cleaner",
    desc: "Offer my eco-certified cleaning services and earn on DORIX.",
    color: "#4CB87A",
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<"customer" | "provider" | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleContinue() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selected }),
      })
      if (!res.ok) throw new Error("Failed to set role")
      router.push(selected === "provider" ? "/onboarding/provider" : "/dashboard")
    } catch {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-serif font-bold text-[#2B3441] mb-2">Welcome to DORIX</h1>
        <p className="text-[#6B7280] text-sm">How would you like to use DORIX?</p>
      </div>

      <div className="space-y-3 mb-8">
        {ROLES.map(({ value, icon: Icon, title, desc, color }) => (
          <button
            key={value}
            onClick={() => setSelected(value)}
            className={cn(
              "w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all",
              selected === value
                ? "border-[#2D7A5F] bg-[#F4FAF6]"
                : "border-[#E5EDE9] bg-white hover:border-[#2D7A5F]/40"
            )}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: selected === value ? color : "#EDF5F0" }}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: selected === value ? "#fff" : color }}
              />
            </div>
            <div>
              <p className="font-semibold text-[#2B3441] mb-0.5">{title}</p>
              <p className="text-sm text-[#6B7280] leading-snug">{desc}</p>
            </div>
            {selected === value && (
              <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-[#2D7A5F] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected || loading}
        className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-12 text-base"
      >
        {loading ? "Setting up..." : "Continue"}
        {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    </div>
  )
}
