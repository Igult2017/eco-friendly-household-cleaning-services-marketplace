import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  number: number
  label: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((step, i) => {
        const isDone = currentStep > step.number
        const isActive = currentStep === step.number

        return (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                  isDone && "bg-[#2D7A5F] border-[#2D7A5F] text-white",
                  isActive && "bg-white border-[#2D7A5F] text-[#2D7A5F]",
                  !isDone && !isActive && "bg-white border-[#E5EDE9] text-[#9ca3af]"
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={cn(
                  "text-[11px] mt-1.5 font-medium text-center leading-tight",
                  isActive && "text-[#2D7A5F]",
                  isDone && "text-[#2D7A5F]",
                  !isDone && !isActive && "text-[#9ca3af]"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-1 -mt-5 transition-colors",
                  currentStep > step.number ? "bg-[#2D7A5F]" : "bg-[#E5EDE9]"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
