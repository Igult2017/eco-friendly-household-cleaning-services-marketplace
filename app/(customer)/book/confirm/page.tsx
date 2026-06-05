"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { StripePaymentForm } from "@/components/booking/StripePaymentForm"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CATEGORY_SERVICE_MAP: Record<string, string> = {
  "regular-cleaning": "Regular Cleaning",
  "deep-cleaning": "Deep Cleaning",
  "move-in-out": "Move-In / Move-Out",
  "office-cleaning": "Office Cleaning",
  "laundry": "Laundry Service",
  "window-cleaning": "Window Cleaning",
}

export default function BookStep5Page() {
  const router = useRouter()
  const store = useBookingStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<{ subtotalCents: number; platformFee: number; totalCharged: number } | null>(null)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ bookingId: string; bookingNumber: string } | null>(null)

  useEffect(() => {
    if (!store.selectedProviderId || !store.scheduledAt || !store.address || !store.categoryId) {
      router.replace("/book")
      return
    }
    createIntent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createIntent() {
    setLoading(true)
    setError(null)
    try {
      // Fetch services to get serviceId for this provider+category
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services?categorySlug=${store.categoryId}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) {
        setError("This provider doesn't offer that service. Please go back and try another provider.")
        return
      }
      setServiceId(service.id)

      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          serviceId: service.id,
          scheduledAt: store.scheduledAt!.toISOString(),
          durationMinutes: store.durationMinutes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to prepare payment"); return }
      setClientSecret(data.clientSecret)
      setIntentId(data.paymentIntentId)
      setAmounts(data.amounts)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] py-20 px-4 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">Booking Confirmed!</h1>
        <p className="text-[#6B7280] text-center mb-2">Booking number: <strong className="text-[#2B3441]">{success.bookingNumber}</strong></p>
        <p className="text-sm text-[#6B7280] text-center mb-8 max-w-sm">
          Your card has been pre-authorised. You will only be charged once the cleaning is marked complete.
        </p>
        <Button onClick={() => { store.reset(); router.push("/dashboard") }} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white px-8 h-11">
          Go to My Bookings
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={5} />

      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">Review & Pay</h1>
        <p className="text-center text-[#6B7280] mb-8">Almost done — review your booking and complete payment</p>

        {/* Order summary */}
        {amounts && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
            <h2 className="font-semibold text-[#2B3441] mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#6B7280]">
                <span>{CATEGORY_SERVICE_MAP[store.categoryId ?? ""] ?? "Cleaning Service"}</span>
                <span>{formatCurrency(amounts.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-[#6B7280]">
                <span>Service fee (15%)</span>
                <span>{formatCurrency(amounts.platformFee)}</span>
              </div>
              <div className="border-t border-[#E5EBF0] my-2" />
              <div className="flex justify-between font-bold text-[#2B3441] text-base">
                <span>Total charged today</span>
                <span className="text-[#2D7A5F]">{formatCurrency(amounts.totalCharged)}</span>
              </div>
              <p className="text-xs text-[#9CA3AF]">Pre-authorisation only. Charged after completion.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 size={20} className="animate-spin text-[#2D7A5F]" />
              <span className="text-[#6B7280]">Preparing payment…</span>
            </div>
          )}
          {error && !loading && (
            <div className="py-4">
              <p className="text-red-500 text-sm mb-3">{error}</p>
              <Button variant="outline" onClick={createIntent} className="border-[#E5EBF0]">Retry</Button>
            </div>
          )}
          {clientSecret && intentId && serviceId && !loading && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#2D7A5F" } } }}>
              <StripePaymentForm
                paymentIntentId={intentId}
                providerId={store.selectedProviderId!}
                serviceId={serviceId}
                bookingPayload={{
                  scheduledAt: store.scheduledAt!.toISOString(),
                  durationMinutes: store.durationMinutes,
                  serviceAddress: store.address!,
                  serviceLatitude: store.latitude ?? undefined,
                  serviceLongitude: store.longitude ?? undefined,
                  specialInstructions: store.specialInstructions || undefined,
                  ecoOptions: store.ecoOptions,
                }}
                onSuccess={(id, num) => setSuccess({ bookingId: id, bookingNumber: num })}
              />
            </Elements>
          )}
        </div>

        {!loading && !success && (
          <Button variant="ghost" onClick={() => router.push("/book/extras")} className="w-full text-[#6B7280]">
            ← Back to details
          </Button>
        )}
      </div>
    </div>
  )
}
