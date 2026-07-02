"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { StripePaymentForm } from "@/components/booking/StripePaymentForm"
import { useBookingStore } from "@/stores/bookingStore"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { getCurrencyForCountry } from "@/lib/utils/locale"
import { Loader2, CheckCircle2, Leaf, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CATEGORY_SERVICE_KEYS: Record<string, string> = {
  "regular-cleaning": "categoryRegularCleaning",
  "deep-cleaning": "categoryDeepCleaning",
  "move-in-out": "categoryMoveInOut",
  "office-cleaning": "categoryOfficeCleaning",
  "laundry": "categoryLaundry",
  "window-cleaning": "categoryWindowCleaning",
}

const CARBON_OFFSET_CENTS = 200

export default function BookStep5Page() {
  const t = useTranslations("customerBookConfirmPage")
  const router = useRouter()
  const store = useBookingStore()
  // Render every amount in the selected cleaner's currency (EU vs US) — matches what's charged.
  const currency = getCurrencyForCountry(store.providerCountry ?? "DE")

  const [step, setStep] = useState<"summary" | "payment">("summary")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<{ subtotalCents: number; totalCharged: number } | null>(null)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ bookingId: string; bookingNumber: string } | null>(null)
  const [addCarbonOffset, setAddCarbonOffset] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [promoCodeId, setPromoCodeId] = useState<string | null>(null)
  const [promoDiscountCents, setPromoDiscountCents] = useState(0)
  const [promoLabel, setPromoLabel] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)

  // Bid-flow bookings (accepted bid) may have null categoryId or a slug instead of UUID.
  // They always have bidAmountCents set. Loosen the guard accordingly.
  const isBidFlow = store.bidAmountCents !== null

  useEffect(() => {
    const missingBase = !store.selectedProviderId || !store.address
    const missingWizard = !isBidFlow && (!store.scheduledAt || !store.categoryId)
    if (missingBase || missingWizard) {
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
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services${store.categoryId ? `?categorySlug=${store.categoryId}` : ""}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) { setError(t("errorServiceNotFoundSupport")); return }

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
          requestedFrequency: store.frequency !== "one_time" ? store.frequency : undefined,
          requestedDays: store.frequency !== "one_time" && store.recurringDays.length ? store.recurringDays : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("errorBookingFailedSupport")); return }
      setSuccess({ bookingId: data.bookingId, bookingNumber: data.bookingNumber })
    } catch {
      setError(t("errorCompleteBookingSupport"))
    } finally {
      setLoading(false)
    }
  }

  async function fetchPricePreview() {
    if (amounts) return // already loaded
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services${store.categoryId ? `?categorySlug=${store.categoryId}` : ""}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) { setError(t("errorProviderNoService")); return }
      setServiceId(service.id)
      // Sum any selected add-ons so the preview total matches what the PI will charge.
      let addOnsTotal = 0
      if (store.addOnIds.length > 0) {
        try {
          const aRes = await fetch(`/api/providers/${store.selectedProviderId}/addons`)
          const aData = await aRes.json()
          const list: { id: string; priceCents: number }[] = Array.isArray(aData.addons) ? aData.addons : []
          addOnsTotal = list.filter((a) => store.addOnIds.includes(a.id)).reduce((s, a) => s + a.priceCents, 0)
        } catch { /* ignore — PI recomputes server-side anyway */ }
      }
      // Commission is deducted from the cleaner, so the customer's price is simply the
      // service price (+ add-ons, after any promo) + the optional offset — no fee on top.
      // Bug 5: bid-flow bookings use the accepted bid amount, not the service list price
      const subtotalCents: number = (store.bidAmountCents ?? service.basePrice) + addOnsTotal
      setAmounts({ subtotalCents, totalCharged: subtotalCents })
    } catch {
      setError(t("errorLoadPricing"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (store.selectedProviderId && store.categoryId) fetchPricePreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function applyPromoCode() {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setPromoError(null)
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim(), subtotalCents: amounts?.subtotalCents ?? 0 }),
      })
      const data = await res.json()
      if (!res.ok) { setPromoError(data.error ?? t("errorInvalidPromo")); return }
      setPromoCodeId(data.promoCodeId)
      setPromoDiscountCents(data.discountCents)
      setPromoLabel(data.label ?? promoCode.trim().toUpperCase())
    } catch {
      setPromoError(t("errorApplyPromo"))
    } finally {
      setPromoLoading(false)
    }
  }

  function removePromoCode() {
    setPromoCode("")
    setPromoCodeId(null)
    setPromoDiscountCents(0)
    setPromoLabel(null)
    setPromoError(null)
  }

  async function proceedToPayment() {
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services${store.categoryId ? `?categorySlug=${store.categoryId}` : ""}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service) { setError(t("errorServiceNotFound")); return }

      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          serviceId: service.id,
          scheduledAt: store.scheduledAt!,
          durationMinutes: store.durationMinutes,
          carbonOffsetCents: addCarbonOffset ? CARBON_OFFSET_CENTS : 0,
          addOnIds: store.addOnIds,
          // Bug 5: pass bid amount so PI uses the accepted price, not the list price
          ...(store.bidAmountCents !== null ? { bidAmountCents: store.bidAmountCents } : {}),
          ...(promoCodeId ? { promoCodeId, promoCodeDiscountCents: promoDiscountCents } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("errorPreparePayment")); return }
      setClientSecret(data.clientSecret)
      setIntentId(data.paymentIntentId)
      setAmounts(data.amounts)
      store.setCarbonOffset(addCarbonOffset ? CARBON_OFFSET_CENTS : 0)
      setStep("payment")
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  // Commission is deducted from the cleaner — the customer pays the service price
  // (after any promo) plus the optional carbon offset. No fee is added on top.
  // In SUMMARY mode `amounts` is the local preview (base + add-ons, no promo applied) so we
  // subtract the promo here. In PAYMENT mode `amounts` is the PI response, whose subtotalCents
  // ALREADY has the promo applied — subtracting again would under-count the total.
  const previewSubtotal = amounts
    ? (step === "summary" ? Math.max(0, amounts.subtotalCents - (promoCodeId ? promoDiscountCents : 0)) : amounts.subtotalCents)
    : null
  const totalWithOffset = previewSubtotal !== null
    ? previewSubtotal + (addCarbonOffset ? CARBON_OFFSET_CENTS : 0)
    : null

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] py-20 px-4 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">{t("bookingConfirmedTitle")}</h1>
        <p className="text-[#6B7280] text-center mb-2">{t("bookingNumberLabel")} <strong className="text-[#2B3441]">{success.bookingNumber}</strong></p>
        <p className="text-sm text-[#6B7280] text-center mb-6 max-w-sm">
          {t("confirmationEmailNote")}
        </p>
        {store.frequency !== "one_time" && (
          <div className="mb-6 max-w-sm w-full rounded-xl border border-[#2D7A5F]/20 bg-[#EDF5F0] px-5 py-4 text-center">
            <p className="text-sm font-semibold text-[#2B3441] mb-1">{t("recurringPromptTitle")}</p>
            <p className="text-xs text-[#6B7280] mb-3">{t("recurringPromptText")}</p>
            <Button onClick={() => { const id = success.bookingId; store.reset(); router.push(`/recurring/new?bookingId=${id}`) }} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white h-9 text-sm">
              {t("setUpRecurring")}
            </Button>
          </div>
        )}
        <Button onClick={() => { store.reset(); router.push("/dashboard") }} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white px-8 h-11">
          {t("goToMyBookings")}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={5} />

      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">{t("reviewAndPayTitle")}</h1>
        <p className="text-center text-[#6B7280] mb-8">{t("reviewAndPaySubtitle")}</p>

        {/* Order summary — always visible */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
          <h2 className="font-semibold text-[#2B3441] mb-4">{t("orderSummary")}</h2>
          {loading && !amounts ? (
            <div className="flex items-center justify-center py-6 gap-3">
              <Loader2 size={18} className="animate-spin text-[#2D7A5F]" />
              <span className="text-sm text-[#6B7280]">{t("loadingPricing")}</span>
            </div>
          ) : amounts ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#6B7280]">
                <span>{CATEGORY_SERVICE_KEYS[store.categoryId ?? ""] ? t(CATEGORY_SERVICE_KEYS[store.categoryId ?? ""]) : t("defaultCleaningService")}</span>
                <span>{formatCurrency(amounts.subtotalCents, currency)}</span>
              </div>

              {/* Promo code input */}
              {step === "summary" && (
                <>
                  <div className="border-t border-[#E5EBF0] my-2" />
                  {promoCodeId ? (
                    <div className="flex items-center justify-between rounded-xl bg-[#F4FAF6] border border-[#2D7A5F]/30 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-[#2D7A5F]" />
                        <span className="text-[#2B3441] font-medium">{promoLabel}</span>
                        <span className="text-xs text-[#2D7A5F]">{t("promoApplied")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#2D7A5F] font-semibold">-{formatCurrency(promoDiscountCents, currency)}</span>
                        <button onClick={removePromoCode} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label={t("removePromoAria")}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("promoPlaceholder")}
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value); setPromoError(null) }}
                        onKeyDown={(e) => e.key === "Enter" && applyPromoCode()}
                        className="h-9 text-sm border-[#E5EBF0] focus-visible:ring-[#2D7A5F]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={applyPromoCode}
                        disabled={promoLoading || !promoCode.trim()}
                        className="h-9 px-4 border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#F4FAF6] shrink-0"
                      >
                        {promoLoading ? <Loader2 size={14} className="animate-spin" /> : t("apply")}
                      </Button>
                    </div>
                  )}
                  {promoError && <p className="text-red-500 text-xs">{promoError}</p>}
                </>
              )}

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
                      <span className="text-[#2B3441] font-medium">{t("carbonOffset")}</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">{t("carbonOffsetDescription")}</p>
                  </div>
                </div>
                <span className="text-[#6B7280] font-medium">{addCarbonOffset ? formatCurrency(CARBON_OFFSET_CENTS, currency) : "—"}</span>
              </label>

              <div className="border-t border-[#E5EBF0] my-2" />
              <div className="flex justify-between font-bold text-[#2B3441] text-base">
                <span>{t("totalChargedToday")}</span>
                <span className="text-[#2D7A5F]">{formatCurrency(totalWithOffset ?? amounts.totalCharged, currency)}</span>
              </div>
              <p className="text-xs text-[#9CA3AF]">{t("preAuthNote")}</p>
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
              {loading ? <><Loader2 size={18} className="animate-spin mr-2" />{t("preparingPayment")}</> : t("continueToPayment")}
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
                    requestedFrequency: store.frequency !== "one_time" ? store.frequency : undefined,
                    requestedDays: store.frequency !== "one_time" && store.recurringDays.length ? store.recurringDays : undefined,
                  }}
                  onSuccess={(id, num) => setSuccess({ bookingId: id, bookingNumber: num })}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 size={20} className="animate-spin text-[#2D7A5F]" />
                <span className="text-[#6B7280]">{t("preparingPayment")}</span>
              </div>
            )}
          </div>
        )}

        {step === "summary" && !loading && (
          <Button variant="ghost" onClick={() => router.push("/book/extras")} className="w-full text-[#6B7280]">
            {t("backToDetails")}
          </Button>
        )}
      </div>
    </div>
  )
}
