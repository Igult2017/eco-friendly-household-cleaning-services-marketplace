"use client"

import { useState } from "react"
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

// Inline "save a card" form — confirms a SetupIntent (no charge), attaching the card to the
// customer for reuse at checkout + recurring bookings.
export function AddCardForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("customerPaymentMethods")
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)
    const { error: err } = await stripe.confirmSetup({ elements, redirect: "if_required" })
    if (err) {
      setError(err.message ?? t("error"))
      setLoading(false)
      return
    }
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || loading} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">
          {loading ? <><Loader2 size={15} className="animate-spin mr-2" />{t("saving")}</> : t("save")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
