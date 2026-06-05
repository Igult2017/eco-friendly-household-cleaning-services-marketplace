"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { StepIndicator } from "@/components/onboarding/StepIndicator"
import { BusinessDetailsForm } from "@/components/onboarding/BusinessDetailsForm"
import { ProviderIdentityStep } from "@/components/onboarding/ProviderIdentityStep"
import { ProviderPayoutStep } from "@/components/onboarding/ProviderPayoutStep"
import type { ProviderProfileInput } from "@/lib/validations/provider"

const STEPS = [
  { number: 1, label: "Profile" },
  { number: 2, label: "Identity" },
  { number: 3, label: "Payouts" },
]

export default function ProviderOnboardingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState(() => {
    const s = searchParams.get("step")
    return s ? parseInt(s) : 1
  })
  const [providerId, setProviderId] = useState<string | null>(null)

  useEffect(() => {
    const s = searchParams.get("step")
    if (s) setStep(parseInt(s))
  }, [searchParams])

  async function handleProfileSubmit(data: ProviderProfileInput) {
    const res = await fetch("/api/providers/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to save profile")
    const json = await res.json()
    setProviderId(json.providerId)
    setStep(2)
    router.replace("/onboarding/provider?step=2")
  }

  function handleStepComplete(nextStep: number) {
    setStep(nextStep)
    router.replace(`/onboarding/provider?step=${nextStep}`)
  }

  function handleFinish() {
    router.push("/provider/dashboard")
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-serif font-bold text-[#2B3441] mb-1">
          Set up your cleaner profile
        </h1>
        <p className="text-[#6B7280] text-sm">
          Complete the steps below to start accepting bookings on DORIX.
        </p>
      </div>

      <StepIndicator steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-2xl border border-[#E5EDE9] shadow-sm p-6">
        {step === 1 && (
          <BusinessDetailsForm onSubmit={handleProfileSubmit} />
        )}
        {step === 2 && (
          <ProviderIdentityStep
            providerId={providerId}
            onComplete={() => handleStepComplete(3)}
            onSkip={() => handleStepComplete(3)}
          />
        )}
        {step === 3 && (
          <ProviderPayoutStep
            onComplete={handleFinish}
            onSkip={handleFinish}
          />
        )}
      </div>
    </div>
  )
}
