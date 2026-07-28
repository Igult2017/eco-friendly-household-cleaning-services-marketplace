"use client"

import { useMemo, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js"
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js"
import { AlertCircle } from "lucide-react"

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")

/**
 * Embedded Stripe Connect Express onboarding for withdrawing a referral discount balance — a
 * lightweight account separate from a cleaner's job-payout account (see StripeConnectEmbed.tsx,
 * which this deliberately does not share since it's scoped to a different user population and
 * a different backing field: users.referralPayoutAccountId, not providers.stripeAccountId).
 */
export function ReferralPayoutConnect({ onConnected }: { onConnected?: () => void }) {
  const t = useTranslations("compReferralReferralCard")
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)

  const stripeConnectInstance = useMemo<StripeConnectInstance | null>(() => {
    try {
      return loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        locale,
        fetchClientSecret: async () => {
          const res = await fetch("/api/referrals/connect-account", { method: "POST" })
          if (!res.ok) throw new Error("Failed to create Stripe Connect session")
          const { clientSecret } = await res.json()
          return clientSecret as string
        },
      })
    } catch {
      setError(t("payoutConnectError"))
      return null
    }
  }, [t, locale])

  if (error || !stripeConnectInstance) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error ?? t("payoutConnectError")}
      </div>
    )
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <ConnectAccountOnboarding
        onExit={() => onConnected?.()}
        collectionOptions={{ fields: "currently_due", futureRequirements: "omit" }}
        fullTermsOfServiceUrl={`${APP_URL}/legal/terms`}
        privacyPolicyUrl={`${APP_URL}/legal/privacy`}
      />
    </ConnectComponentsProvider>
  )
}
