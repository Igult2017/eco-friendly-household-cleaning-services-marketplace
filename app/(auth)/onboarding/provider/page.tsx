import { Suspense } from "react"
import { ProviderOnboardingClient } from "./ProviderOnboardingClient"

export default function ProviderOnboardingPage() {
  return (
    <Suspense>
      <ProviderOnboardingClient />
    </Suspense>
  )
}
