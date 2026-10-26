"use client"

import { useRouter } from "next/navigation"
import { ProviderPayoutStep } from "@/components/onboarding/ProviderPayoutStep"

/**
 * `nextStep` is "/onboarding/identity" only when an admin has chosen to verify cleaners at signup;
 * otherwise it is the dashboard, exactly as before. Decided on the server (page.tsx) so the setting
 * is read once rather than trusted from the browser.
 */
export function OnboardingPayoutClient({ nextStep = "/provider/dashboard" }: { nextStep?: string }) {
  const router = useRouter()
  const goNext = () => router.push(nextStep)

  return <ProviderPayoutStep onConnected={goNext} onSkip={goNext} />
}
