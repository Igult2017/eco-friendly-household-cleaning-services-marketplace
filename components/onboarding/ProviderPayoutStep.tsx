"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CreditCard, CheckCircle, ExternalLink, AlertCircle } from "lucide-react"

interface Props {
  onComplete: () => void
  onSkip: () => void
}

export function ProviderPayoutStep({ onComplete, onSkip }: Props) {
  const searchParams = useSearchParams()
  const isSuccess = searchParams.get("success") === "1"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connectStripe() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/connect/account", { method: "POST" })
      if (!res.ok) throw new Error("Failed to start Stripe Connect")
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setError("Could not start Stripe Connect. Please try again.")
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-[#2D7A5F]" />
        </div>
        <h2 className="text-lg font-semibold text-[#2B3441] mb-2">Stripe account connected!</h2>
        <p className="text-sm text-[#6B7280] mb-6">
          Your payout account is set up. You'll receive your earnings weekly every Monday.
        </p>
        <Button onClick={onComplete} className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11">
          Go to my dashboard →
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-5">
        <CreditCard className="w-8 h-8 text-[#2D7A5F]" />
      </div>
      <h2 className="text-lg font-semibold text-[#2B3441] mb-2">Set up payouts</h2>
      <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto leading-relaxed">
        Connect your bank account via Stripe to receive weekly payouts. DORIX charges
        a 15% platform fee — you keep 100% of your quoted price.
      </p>

      <div className="bg-[#F4FAF6] rounded-xl p-4 border border-[#E5EDE9] text-left mb-6 space-y-2">
        {[
          "Weekly payouts every Monday",
          "Direct bank transfer via Stripe",
          "Full earnings transparency in your dashboard",
          "€0 payout fees for standard transfers",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-[#2B3441]">
            <CheckCircle className="w-3.5 h-3.5 text-[#2D7A5F] flex-shrink-0" />
            {item}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={connectStripe}
          disabled={loading}
          className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {loading ? "Redirecting to Stripe..." : "Connect Stripe account"}
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full text-[#6B7280] hover:text-[#2B3441] text-sm">
          Skip for now
        </Button>
      </div>
      <p className="text-xs text-[#6B7280] mt-4">
        You can connect Stripe later from your dashboard. Payouts require a connected account.
      </p>
    </div>
  )
}
