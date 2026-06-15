"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { useTranslations } from "next-intl"

const STEPS = [
  { n: 1, labelKey: "stepService" },
  { n: 2, labelKey: "stepLocation" },
  { n: 3, labelKey: "stepSchedule" },
  { n: 4, labelKey: "stepDetails" },
  { n: 5, labelKey: "stepPayment" },
] as const

export function WizardProgress({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  const t = useTranslations("compBookingWizardProgress")
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-lg mx-auto mb-8">
      {STEPS.map((step, i) => {
        const done = current > step.n
        const active = current === step.n
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                  done && "bg-[#2D7A5F] text-white",
                  active && "bg-[#2B3441] text-white ring-4 ring-[#D1F0E0]",
                  !done && !active && "bg-[#E5EBF0] text-[#9CA3AF]"
                )}
              >
                {done ? <Check size={16} /> : step.n}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  active && "text-[#2B3441]",
                  done && "text-[#2D7A5F]",
                  !done && !active && "text-[#9CA3AF]"
                )}
              >
                {t(step.labelKey)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-8 sm:w-12 mx-1 transition-all", done ? "bg-[#2D7A5F]" : "bg-[#E5EBF0]")} />
            )}
          </div>
        )
      })}
    </div>
  )
}
