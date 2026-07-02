"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
    carbonOffsetCents?: number
    requestedFrequency?: string
    requestedDays?: number[]
  }
}

export function StripePaymentForm({ paymentIntentId, providerId, serviceId, onSuccess, bookingPayload }: Props) {
  const t = useTranslations("compBookingStripePaymentForm")
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

    // Retry after a transient booking-POST failure: the card is ALREADY authorized, so re-confirming
    // errors with "unexpected state" — treat that as success and proceed to (re-)create the booking
    // (the API is idempotent per PaymentIntent). Otherwise the authorized hold was unrecoverable.
    const alreadyAuthorized =
      stripeError?.code === "payment_intent_unexpected_state" &&
      stripeError.payment_intent?.status === "requires_capture"
    if (stripeError && !alreadyAuthorized) {
      setError(stripeError.message ?? t("paymentFailed"))
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
        setError(data.error ?? t("bookingCreationFailed"))
        return
      }

      onSuccess(data.bookingId, data.bookingNumber)
    } catch {
      setError(t("genericError"))
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
          <><Loader2 size={16} className="animate-spin mr-2" /> {t("processing")}</>
        ) : (
          <><Lock size={15} className="mr-2" /> {t("confirmAndReserve")}</>
        )}
      </Button>
      <p className="text-xs text-center text-[#6B7280]">
        {t("preAuthNotice")}
      </p>
    </form>
  )
}
