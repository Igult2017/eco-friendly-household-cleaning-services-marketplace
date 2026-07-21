"use client"

import { useRouter } from "next/navigation"
import { ProviderPayoutStep } from "@/components/onboarding/ProviderPayoutStep"

export function OnboardingPayoutClient() {
  const router = useRouter()
  const goToDashboard = () => router.push("/provider/dashboard")

  return <ProviderPayoutStep onConnected={goToDashboard} onSkip={goToDashboard} />
}
