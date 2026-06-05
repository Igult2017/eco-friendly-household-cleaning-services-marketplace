"use client"

import { useState } from "react"
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Loader2, Lock } from "lucide-react"

interface Props {
  paymentIntentId: string
  providerId: string
  serviceId: string
  onSuccess: (bookingId: string, bookingNumber: string) => void
  bookingPayload: {
    scheduledAt: string
    durationMinutes: number
    serviceAddress: object
    serviceLatitude?: number
    serviceLongitude?: number
    specialInstructions?: string
    ecoOptions: string[]
  }
}

export function StripePaymentForm({ paymentIntentId, providerId, serviceId, onSuccess, bookingPayload }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    // Confirm payment (pre-auth: status will be requires_capture)
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + "/book/confirm?status=success" },
      redirect: "if_required",
    })

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed")
      setLoading(false)
      return
    }

    // Create booking record in our DB
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          serviceId,
          paymentIntentId,
          ...bookingPayload,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Booking creation failed")
        return
      }

      onSuccess(data.bookingId, data.bookingNumber)
    } catch {
      setError("Something went wrong. Please contact support.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
          fields: { billingDetails: { email: "auto", name: "auto" } },
        }}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-base"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin mr-2" /> Processing…</>
        ) : (
          <><Lock size={15} className="mr-2" /> Confirm & Reserve</>
        )}
      </Button>
      <p className="text-xs text-center text-[#6B7280]">
        Your card will be pre-authorised now. You are only charged after the cleaning is completed.
      </p>
    </form>
  )
}
