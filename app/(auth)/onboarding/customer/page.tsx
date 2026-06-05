"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle } from "lucide-react"

export default function CustomerOnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState("")
  const [gdprConsent, setGdprConsent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gdprConsent) return
    setLoading(true)
    try {
      await fetch("/api/onboarding/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-full bg-[#D1F0E0] flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-[#2D7A5F]" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-[#2B3441] mb-2">Almost there!</h1>
        <p className="text-[#6B7280] text-sm">Add your phone number to receive booking confirmations.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5EDE9] shadow-sm p-6 space-y-5">
        <div>
          <Label htmlFor="phone" className="text-[#2B3441] text-sm font-medium mb-1.5 block">
            Phone number <span className="text-[#6B7280] font-normal">(optional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+31 6 12345678"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={gdprConsent}
            onChange={(e) => setGdprConsent(e.target.checked)}
            className="mt-0.5 rounded accent-[#2D7A5F]"
            required
          />
          <span className="text-xs text-[#6B7280] leading-relaxed">
            I agree to DORIX&apos;s{" "}
            <a href="/terms" target="_blank" className="text-[#2D7A5F] underline">Terms of Service</a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="text-[#2D7A5F] underline">Privacy Policy</a>.
            I consent to the processing of my personal data in accordance with GDPR.
          </span>
        </label>

        <Button
          type="submit"
          disabled={!gdprConsent || loading}
          className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11"
        >
          {loading ? "Saving..." : "Start booking →"}
        </Button>
      </form>
    </div>
  )
}
