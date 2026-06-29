"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2 } from "lucide-react"

// Client's "Confirm completion" — the second half of dual-confirm. On success the cleaner is paid.
export function ConfirmCompletionButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("customerBookingsIdPage")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/bookings/${bookingId}/confirm-completion`, { method: "POST" })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error ?? "Something went wrong. Please try again.")
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={confirm}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold px-4 py-3 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {t("confirmCompletion")}
      </button>
      {error && <p className="text-xs text-red-500 mt-1.5 text-center">{error}</p>}
    </div>
  )
}
