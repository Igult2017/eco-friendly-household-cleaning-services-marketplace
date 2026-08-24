"use client"

import { useRouter } from "next/navigation"
import { ClientPaymentStep } from "@/components/onboarding/ClientPaymentStep"

export function OnboardingPaymentClient() {
  const router = useRouter()
  const goToDashboard = () => router.push("/dashboard")

  return <ClientPaymentStep onSaved={goToDashboard} onSkip={goToDashboard} />
}
