"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js"
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js"
import { AlertCircle, Loader2 } from "lucide-react"

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

  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null)

  // Browser-only setup, deliberately in useEffect (never useMemo): this fetches a relative URL,
  // which only resolves against "this page's own address" in an actual browser. Running it during
  // the server-side render pass (which useMemo does, but useEffect never does) crashed with
  // "Failed to parse URL from /api/referrals/connect-account" on every page load — Stripe's own
  // ConnectJS already expects/tolerates being loaded during SSR, but our fetch call doesn't.
  useEffect(() => {
    try {
      setStripeConnectInstance(
        loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          locale,
          fetchClientSecret: async () => {
            const res = await fetch("/api/referrals/connect-account", { method: "POST" })
            if (!res.ok) throw new Error("Failed to create Stripe Connect session")
            const { clientSecret } = await res.json()
            return clientSecret as string
          },
        }),
      )
    } catch {
      setError(t("payoutConnectError"))
    }
  }, [t, locale])

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    )
  }

  // Brief, genuine loading window while the browser-only setup effect above runs — not an error,
  // just hasn't finished yet.
  if (!stripeConnectInstance) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-[#2D7A5F]" />
      </div>
    )
  }

  async function refreshStatus() {
    // No webhook is wired for this separate account population — live-refresh the stored status
    // right away so the parent's UI can show "Withdraw" instead of looping back into "Connect".
    try {
      await fetch("/api/referrals/connect-status", { method: "POST" })
    } catch { /* best-effort — the withdraw route re-verifies live anyway */ }
    onConnected?.()
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <ConnectAccountOnboarding
        onExit={refreshStatus}
        collectionOptions={{ fields: "currently_due", futureRequirements: "omit" }}
        fullTermsOfServiceUrl={`${APP_URL}/legal/terms`}
        privacyPolicyUrl={`${APP_URL}/legal/privacy`}
      />
    </ConnectComponentsProvider>
  )
}
