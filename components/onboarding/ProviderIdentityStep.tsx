"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ExternalLink, AlertCircle } from "lucide-react"

interface Props {
  providerId: string | null
  onComplete: () => void
  onSkip: () => void
}

export function ProviderIdentityStep({ onComplete, onSkip }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startVerification() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/identity/session", { method: "POST" })
      if (!res.ok) throw new Error("Failed to start verification")
      const { url } = await res.json()
      window.location.href = url
    } catch (e) {
      setError("Could not start identity verification. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-5">
        <ShieldCheck className="w-8 h-8 text-[#2D7A5F]" />
      </div>
      <h2 className="text-lg font-semibold text-[#2B3441] mb-2">Identity verification</h2>
      <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto leading-relaxed">
        DORIXÉ requires all providers to verify their identity via Stripe. This ensures
        customer safety and enables payouts to your bank account.
      </p>

      <div className="bg-[#F4FAF6] rounded-xl p-4 border border-[#E5EDE9] text-left mb-6">
        <p className="text-xs font-semibold text-[#2B3441] mb-2">What you'll need:</p>
        <ul className="space-y-1 text-xs text-[#6B7280]">
          <li>• A government-issued ID (passport, national ID, or driver's licence)</li>
          <li>• A selfie / photo taken during verification</li>
          <li>• The process takes 2–3 minutes and is handled securely by Stripe</li>
        </ul>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={startVerification}
          disabled={loading}
          className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {loading ? "Redirecting to Stripe..." : "Start identity verification"}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full text-[#6B7280] hover:text-[#2B3441] text-sm"
        >
          Skip for now — I'll do this later
        </Button>
      </div>
      <p className="text-xs text-[#6B7280] mt-4">
        You can continue without verifying, but you won't be approved until identity
        verification is complete.
      </p>
    </div>
  )
}
