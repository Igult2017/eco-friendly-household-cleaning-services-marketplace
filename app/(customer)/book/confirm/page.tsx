"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { StripePaymentForm } from "@/components/booking/StripePaymentForm"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { Loader2, CheckCircle2, Leaf } from "lucide-react"
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

const CARBON_OFFSET_CENTS = 200

export default function BookStep5Page() {
  const router = useRouter()
  const store = useBookingStore()

  const [step, setStep] = useState<"summary" | "payment">("summary")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<{ subtotalCents: number; platformFee: number; totalCharged: number } | null>(null)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ bookingId: string; bookingNumber: string } | null>(null)
  const [addCarbonOffset, setAddCarbonOffset] = useState(false)

  useEffect(() => {
    if (!store.selectedProviderId || !store.scheduledAt || !store.address || !store.categoryId) {
      router.replace("/book")
      return
    }
    // Detect 3DS/SCA redirect return — complete the booking using the persisted store state
    const params = new URLSearchParams(window.location.search)
    const piId = params.get("payment_intent")
    const redirectStatus = params.get("redirect_status")
    if (piId && redirectStatus === "succeeded") {
      autoCompleteBooking(piId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function autoCompleteBooking(piId: string) {
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services?categorySlug=${store.categoryId}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) { setError("Service not found. Please contact support."); return }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          serviceId: service.id,
          paymentIntentId: piId,
          scheduledAt: store.scheduledAt,
          durationMinutes: store.durationMinutes,
          serviceAddress: store.address,
          serviceLatitude: store.latitude ?? undefined,
          serviceLongitude: store.longitude ?? undefined,
          specialInstructions: store.specialInstructions || undefined,
          ecoOptions: store.ecoOptions,
          carbonOffsetCents: store.carbonOffsetCents || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Booking failed. Please contact support."); return }
      setSuccess({ bookingId: data.bookingId, bookingNumber: data.bookingNumber })
    } catch {
      setError("Failed to complete booking. Please contact support.")
    } finally {
      setLoading(false)
    }
  }

  async function fetchPricePreview() {
    if (amounts) return // already loaded
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services?categorySlug=${store.categoryId}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) { setError("This provider doesn't offer that service."); return }
      setServiceId(service.id)
      // Bug 5: bid-flow bookings use the accepted bid amount, not the service list price
      const subtotalCents: number = store.bidAmountCents ?? service.basePrice
      const platformFee = Math.round(subtotalCents * 0.15)
      const totalCharged = subtotalCents + platformFee
      setAmounts({ subtotalCents, platformFee, totalCharged })
    } catch {
      setError("Failed to load pricing. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (store.selectedProviderId && store.categoryId) fetchPricePreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function proceedToPayment() {
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services?categorySlug=${store.categoryId}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) { setError("Service not found."); return }

      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          serviceId: service.id,
          scheduledAt: store.scheduledAt!,
          durationMinutes: store.durationMinutes,
          carbonOffsetCents: addCarbonOffset ? CARBON_OFFSET_CENTS : 0,
          // Bug 5: pass bid amount so PI uses the accepted price, not the list price
          ...(store.bidAmountCents !== null ? { bidAmountCents: store.bidAmountCents } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to prepare payment"); return }
      setClientSecret(data.clientSecret)
      setIntentId(data.paymentIntentId)
      setAmounts(data.amounts)
      store.setCarbonOffset(addCarbonOffset ? CARBON_OFFSET_CENTS : 0)
      setStep("payment")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const totalWithOffset = amounts
    ? amounts.totalCharged + (addCarbonOffset ? CARBON_OFFSET_CENTS : 0)
    : null

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] py-20 px-4 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">Booking Confirmed!</h1>
        <p className="text-[#6B7280] text-center mb-2">Booking number: <strong className="text-[#2B3441]">{success.bookingNumber}</strong></p>
        <p className="text-sm text-[#6B7280] text-center mb-8 max-w-sm">
          A confirmation has been sent to your email. Your card has been pre-authorised — you will only be charged once the cleaning is marked complete.
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
        <p className="text-center text-[#6B7280] mb-8">Review your booking details and complete payment</p>

        {/* Order summary — always visible */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
          <h2 className="font-semibold text-[#2B3441] mb-4">Order Summary</h2>
          {loading && !amounts ? (
            <div className="flex items-center justify-center py-6 gap-3">
              <Loader2 size={18} className="animate-spin text-[#2D7A5F]" />
              <span className="text-sm text-[#6B7280]">Loading pricing…</span>
            </div>
          ) : amounts ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#6B7280]">
                <span>{CATEGORY_SERVICE_MAP[store.categoryId ?? ""] ?? "Cleaning Service"}</span>
                <span>{formatCurrency(amounts.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-[#6B7280]">
                <span>Service fee (15%)</span>
                <span>{formatCurrency(amounts.platformFee)}</span>
              </div>

              {/* Carbon offset toggle */}
              <div className="border-t border-[#E5EBF0] my-2" />
              <label className={`flex items-center justify-between cursor-pointer rounded-xl px-3 py-2.5 transition-colors ${addCarbonOffset ? "bg-[#F4FAF6] border border-[#2D7A5F]/30" : "hover:bg-gray-50"}`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={addCarbonOffset}
                    onChange={(e) => setAddCarbonOffset(e.target.checked)}
                    disabled={step === "payment"}
                    className="h-4 w-4 accent-[#2D7A5F] rounded"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Leaf size={13} className="text-[#2D7A5F]" />
                      <span className="text-[#2B3441] font-medium">Carbon offset</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">Plant trees to neutralise this service</p>
                  </div>
                </div>
                <span className="text-[#6B7280] font-medium">{addCarbonOffset ? formatCurrency(CARBON_OFFSET_CENTS) : "—"}</span>
              </label>

              <div className="border-t border-[#E5EBF0] my-2" />
              <div className="flex justify-between font-bold text-[#2B3441] text-base">
                <span>Total charged today</span>
                <span className="text-[#2D7A5F]">{formatCurrency(totalWithOffset ?? amounts.totalCharged)}</span>
              </div>
              <p className="text-xs text-[#9CA3AF]">Pre-authorisation only. Charged after completion.</p>
            </div>
          ) : null}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        {/* Step: summary → show proceed button */}
        {step === "summary" && amounts && (
          <div className="space-y-3 mb-6">
            <Button
              onClick={proceedToPayment}
              disabled={loading}
              className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-base"
            >
              {loading ? <><Loader2 size={18} className="animate-spin mr-2" />Preparing payment…</> : "Continue to Payment"}
            </Button>
          </div>
        )}

        {/* Step: payment → Stripe form */}
        {step === "payment" && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
            {clientSecret && intentId && serviceId ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#2D7A5F" } } }}>
                <StripePaymentForm
                  paymentIntentId={intentId}
                  providerId={store.selectedProviderId!}
                  serviceId={serviceId}
                  bookingPayload={{
                    scheduledAt: store.scheduledAt!,
                    durationMinutes: store.durationMinutes,
                    serviceAddress: store.address!,
                    serviceLatitude: store.latitude ?? undefined,
                    serviceLongitude: store.longitude ?? undefined,
                    specialInstructions: store.specialInstructions || undefined,
                    ecoOptions: store.ecoOptions,
                    carbonOffsetCents: addCarbonOffset ? CARBON_OFFSET_CENTS : undefined,
                  }}
                  onSuccess={(id, num) => setSuccess({ bookingId: id, bookingNumber: num })}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 size={20} className="animate-spin text-[#2D7A5F]" />
                <span className="text-[#6B7280]">Preparing payment…</span>
              </div>
            )}
          </div>
        )}

        {step === "summary" && !loading && (
          <Button variant="ghost" onClick={() => router.push("/book/extras")} className="w-full text-[#6B7280]">
            ← Back to details
          </Button>
        )}
      </div>
    </div>
  )
}
