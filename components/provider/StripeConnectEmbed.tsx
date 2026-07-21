"use client"

import { useMemo, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js"
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js"
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react"

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")

/**
 * Cleaner-facing Stripe Connect Express onboarding, embedded directly in the DORIXÉ app (no
 * redirect to a stripe.com page). Stripe still owns all KYC/identity verification and bank
 * account collection — we only render its component. One step (stripe_user_authentication) is a
 * brief Stripe-owned popup that can't be disabled for Express accounts (Stripe, not DORIXÉ, is
 * legally responsible for verifying the account holder) — we surface plain-language context
 * around it instead, since we can't edit Stripe's own popup content.
 */
export function StripeConnectEmbed({ onConnected }: { onConnected?: () => void }) {
  const t = useTranslations("compOnboardingProviderPayoutStep")
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [verifyingStep, setVerifyingStep] = useState(false)

  const stripeConnectInstance = useMemo<StripeConnectInstance | null>(() => {
    try {
      return loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        locale,
        fetchClientSecret: async () => {
          const res = await fetch("/api/stripe/connect/account", { method: "POST" })
          if (!res.ok) throw new Error("Failed to create Stripe Connect session")
          const { clientSecret } = await res.json()
          return clientSecret as string
        },
      })
    } catch {
      setError(t("connectError"))
      return null
    }
  }, [t, locale])

  async function refreshStatus() {
    try {
      await fetch("/api/stripe/connect/status", { method: "POST" })
    } catch { /* account.updated webhook is the backstop */ }
    onConnected?.()
  }

  if (error || !stripeConnectInstance) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error ?? t("connectError")}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-[#F4FAF6] border border-[#E5EDE9] px-4 py-3 text-xs text-[#2B3441] leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-[#2D7A5F] flex-shrink-0 mt-0.5" />
        {t("kycDisclaimer")}
      </div>

      {verifyingStep && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          {t("kycStepMessage")}
        </div>
      )}

      <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
        <ConnectAccountOnboarding
          onExit={refreshStatus}
          onStepChange={({ step }) => setVerifyingStep(step === "stripe_user_authentication")}
          collectionOptions={{ fields: "currently_due", futureRequirements: "omit" }}
          fullTermsOfServiceUrl={`${APP_URL}/legal/terms`}
          privacyPolicyUrl={`${APP_URL}/legal/privacy`}
        />
      </ConnectComponentsProvider>
    </div>
  )
}
