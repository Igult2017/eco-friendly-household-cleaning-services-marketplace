"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { StripePaymentForm } from "@/components/booking/StripePaymentForm"
import { BookingSuccessScreen } from "@/components/booking/confirm/BookingSuccessScreen"
import { OrderSummaryCard } from "@/components/booking/confirm/OrderSummaryCard"
import { PayoutFallbackCard } from "@/components/booking/confirm/PayoutFallbackCard"
import { useBookingStore } from "@/stores/bookingStore"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { getCurrencyForCountry } from "@/lib/utils/locale"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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
  const [hourlyRateCents, setHourlyRateCents] = useState<number | null>(null)
  const [success, setSuccess] = useState<{ bookingId: string; bookingNumber: string } | null>(null)
  const [addCarbonOffset, setAddCarbonOffset] = useState(false)
  const [referralBalanceCents, setReferralBalanceCents] = useState(0)
  const [applyReferralCredit, setApplyReferralCredit] = useState(false)
  const [referralCreditAppliedCents, setReferralCreditAppliedCents] = useState(0)
  const [promoCode, setPromoCode] = useState("")
  const [promoCodeId, setPromoCodeId] = useState<string | null>(null)
  const [promoDiscountCents, setPromoDiscountCents] = useState(0)
  const [promoLabel, setPromoLabel] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  // Cleaner's payout account not connected → a hold can't be authorized, but the client's card
  // guarantee is independent of that. Fall back to SAVING the card (SetupIntent) + booking.
  const [payoutFallback, setPayoutFallback] = useState(false)
  const [saveCardSecret, setSaveCardSecret] = useState<string | null>(null)
  const [savedCard, setSavedCard] = useState<{ brand: string; last4: string } | null>(null)
  // Cleaner's IANA tz — needed to compute the recurring schedule's next occurrence correctly.
  const [providerTimezone, setProviderTimezone] = useState("Europe/Amsterdam")
  const [recurringSetupResult, setRecurringSetupResult] = useState<"pending" | "success" | "failed" | "skipped" | null>(null)

  // Bid-flow bookings (accepted bid) may have null categoryId or a slug instead of UUID.
  // They always have bidAmountCents set. Loosen the guard accordingly.
  const isBidFlow = store.bidAmountCents !== null
  // Only concrete cadences (set in step 1 of the wizard) can drive auto-schedule-creation — bid-flow's
  // "recurring" value is stated intent only, with no dayOfWeek the /api/recurring schema requires.
  const isConcreteRecurring = store.frequency === "weekly" || store.frequency === "biweekly" || store.frequency === "monthly"

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
      // 3DS return: React state (incl. the server-resolved serviceId) is lost across the redirect.
      // Re-derive best-effort; when none resolves (bid flow), createBooking falls back to the service
      // id pinned in the PaymentIntent metadata — never strand an authorized hold over this.
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services${store.categoryId ? `?categorySlug=${store.categoryId}` : ""}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      if (!service && store.bidAmountCents === null) { setError(t("errorServiceNotFoundSupport")); return }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          ...(service ? { serviceId: service.id } : {}),
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
          acceptedCancellationPolicy: store.acceptedCancellationPolicy,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("errorBookingFailedSupport")); return }
      setSuccess({ bookingId: data.bookingId, bookingNumber: data.bookingNumber })
      // Best-effort, non-blocking: the success screen above never waits on this.
      if (isConcreteRecurring && store.acceptedAutoRenewConsent) {
        setRecurringSetupResult("pending")
        void maybeSetupRecurringSchedule(piId, service?.id ?? serviceId).then(setRecurringSetupResult)
      }
    } catch {
      setError(t("errorCompleteBookingSupport"))
    } finally {
      setLoading(false)
    }
  }

  // Sets up the actual recurring schedule right after the FIRST booking's payment succeeds, using
  // data the wizard already collected — the client never fills out a second form. Best-effort: a
  // failure here must never fail the booking itself, which is already paid for and confirmed.
  async function maybeSetupRecurringSchedule(paymentIntentId: string, svcId: string | null): Promise<"success" | "failed" | "skipped"> {
    const freq = store.frequency
    if (freq !== "weekly" && freq !== "biweekly" && freq !== "monthly") return "skipped"
    if (!svcId || !store.selectedProviderId || !store.scheduledAt || !store.address) return "skipped"
    try {
      const scheduledDate = new Date(store.scheduledAt)
      const dayOfWeek = store.recurringDays[0] ?? scheduledDate.getDay()
      const preferredTime = store.scheduledTimeStr ?? `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(scheduledDate.getMinutes()).padStart(2, "0")}`
      const addr = Object.fromEntries(
        Object.entries(store.address).filter(([, v]) => typeof v === "string" && v)
      ) as Record<string, string>
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          serviceId: svcId,
          frequency: freq,
          dayOfWeek,
          preferredTime,
          serviceAddress: addr,
          ecoOptions: store.ecoOptions,
          specialInstructions: store.specialInstructions || undefined,
          paymentIntentId,
          timezone: providerTimezone,
          autoRenewConsent: true,
        }),
      })
      return res.ok ? "success" : "failed"
    } catch {
      return "failed"
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
      // Bid flow: the accepted bid IS the price — a missing service listing must not dead-end the
      // summary (job posts have no category, and bid-only cleaners may have no listed services).
      if (!service && store.bidAmountCents === null) { setError(t("errorProviderNoService")); return }
      if (service) setServiceId(service.id)
      if (svcData.providerTimezone) setProviderTimezone(svcData.providerTimezone)
      // Per-hour transparency: show the client exactly what they pay per hour on the summary.
      if (service && store.bidAmountCents === null && service.priceUnit === "per_hour") setHourlyRateCents(service.basePrice)
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
      // Mirror the intent route's pricing: per_hour services charge basePrice × booked hours — a flat
      // preview here disagreed with the actual charge by the hours factor.
      const base =
        store.bidAmountCents ??
        (service
          ? service.priceUnit === "per_hour"
            ? Math.round((service.basePrice * store.durationMinutes) / 60)
            : service.basePrice
          : 0)
      const subtotalCents: number = base + addOnsTotal
      setAmounts({ subtotalCents, totalCharged: subtotalCents })
    } catch {
      setError(t("errorLoadPricing"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Bid-flow bookings have NO category (job posts don't carry one) — the accepted bid amount is the
    // price, so the preview must run regardless. Gating on categoryId left bid-flow clients on an
    // empty summary with no pay button.
    if (store.selectedProviderId && (store.categoryId || isBidFlow)) fetchPricePreview()
    // Referral discount balance, if any — same endpoint the referral dashboard card uses.
    fetch("/api/referrals").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.credit?.balanceCents) setReferralBalanceCents(d.credit.balanceCents)
    }).catch(() => {})
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

  // Book WITHOUT adding a card: booking is created with no hold; the cleaner is warned there's no
  // payment method on file (settle directly or ask the client to add one).
  async function bookWithoutCard() {
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services${store.categoryId ? `?categorySlug=${store.categoryId}` : ""}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          ...(service ? { serviceId: service.id } : {}),
          scheduledAt: store.scheduledAt,
          durationMinutes: store.durationMinutes,
          serviceAddress: store.address,
          serviceLatitude: store.latitude ?? undefined,
          serviceLongitude: store.longitude ?? undefined,
          specialInstructions: store.specialInstructions || undefined,
          ecoOptions: store.ecoOptions,
          requestedFrequency: store.frequency !== "one_time" ? store.frequency : undefined,
          requestedDays: store.frequency !== "one_time" && store.recurringDays.length ? store.recurringDays : undefined,
          acceptedCancellationPolicy: store.acceptedCancellationPolicy,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("errorBookingFailedSupport")); return }
      setSuccess({ bookingId: data.bookingId, bookingNumber: data.bookingNumber })
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  // Card-save fallback. NEVER books silently: with a card on file the panel shows it and waits for an
  // explicit "Confirm booking request"; without one it shows the card form (save = no charge).
  async function startPayoutFallback() {
    try {
      const m = await fetch("/api/payments/methods").then((r) => r.json()).catch(() => ({ cards: [] }))
      const card = (m.cards ?? [])[0]
      if (card) {
        setSavedCard({ brand: card.brand, last4: card.last4 })
        setPayoutFallback(true)
        return
      }
      await loadNewCardForm()
    } catch {
      setError(t("errorGeneric"))
    }
  }

  async function loadNewCardForm() {
    const r = await fetch("/api/payments/setup-intent", { method: "POST" })
    const d = await r.json()
    if (!d.clientSecret) { setError(t("errorPreparePayment")); return }
    setSavedCard(null)
    setSaveCardSecret(d.clientSecret)
    setPayoutFallback(true)
  }

  async function proceedToPayment() {
    setLoading(true)
    setError(null)
    try {
      const svcRes = await fetch(`/api/providers/${store.selectedProviderId}/services${store.categoryId ? `?categorySlug=${store.categoryId}` : ""}`)
      const svcData = await svcRes.json()
      const service = svcData.services?.[0]
      // Bid flow may proceed without a service listing — the intent API resolves one server-side.
      if (!service && store.bidAmountCents === null) { setError(t("errorServiceNotFound")); return }

      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: store.selectedProviderId,
          ...(service ? { serviceId: service.id } : {}),
          scheduledAt: store.scheduledAt!,
          durationMinutes: store.durationMinutes,
          carbonOffsetCents: addCarbonOffset ? CARBON_OFFSET_CENTS : 0,
          addOnIds: store.addOnIds,
          // Bug 5: pass bid amount so PI uses the accepted price, not the list price
          ...(store.bidAmountCents !== null ? { bidAmountCents: store.bidAmountCents } : {}),
          ...(promoCodeId ? { promoCodeId, promoCodeDiscountCents: promoDiscountCents } : {}),
          applyReferralCredit,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === "payout_not_ready") { await startPayoutFallback(); return }
        setError(data.error ?? t("errorPreparePayment")); return
      }
      setClientSecret(data.clientSecret)
      setIntentId(data.paymentIntentId)
      setAmounts(data.amounts)
      setReferralCreditAppliedCents(data.amounts?.referralCreditCents ?? 0)
      if (data.serviceId) setServiceId(data.serviceId) // server-resolved (bid flow without a listing)
      store.setCarbonOffset(addCarbonOffset ? CARBON_OFFSET_CENTS : 0)
      setStep("payment")
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  // Commission is deducted from the cleaner — the customer pays the service price
  // (after any promo + referral balance) plus the optional carbon offset. No fee is added on top.
  // In SUMMARY mode `amounts` is the local preview (base + add-ons, no discounts applied) so we
  // subtract the promo + referral balance (capped at what's left) here. In PAYMENT mode `amounts`
  // is the PI response, whose subtotalCents ALREADY has both applied — subtracting again would
  // under-count the total.
  const previewReferralCreditCents = applyReferralCredit
    ? Math.min(referralBalanceCents, Math.max(0, (amounts?.subtotalCents ?? 0) - (promoCodeId ? promoDiscountCents : 0)))
    : 0
  const previewSubtotal = amounts
    ? (step === "summary"
        ? Math.max(0, amounts.subtotalCents - (promoCodeId ? promoDiscountCents : 0) - previewReferralCreditCents)
        : amounts.subtotalCents)
    : null
  const totalWithOffset = previewSubtotal !== null
    ? previewSubtotal + (addCarbonOffset ? CARBON_OFFSET_CENTS : 0)
    : null

  if (success) {
    return (
      <BookingSuccessScreen
        bookingNumber={success.bookingNumber}
        frequency={store.frequency}
        isConcreteRecurring={isConcreteRecurring}
        recurringSetupResult={recurringSetupResult}
        onSetUpRecurring={() => { const id = success.bookingId; store.reset(); router.push(`/recurring/new?bookingId=${id}`) }}
        onGoToBookings={() => { store.reset(); router.push("/dashboard") }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={5} />

      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">{t("reviewAndPayTitle")}</h1>
        <p className="text-center text-[#6B7280] mb-8">{t("reviewAndPaySubtitle")}</p>

        <OrderSummaryCard
          currency={currency}
          loading={loading}
          amounts={amounts}
          hourlyRateCents={hourlyRateCents}
          step={step}
          isConcreteRecurring={isConcreteRecurring}
          totalWithOffset={totalWithOffset}
          promo={{
            code: promoCode,
            setCode: setPromoCode,
            codeId: promoCodeId,
            label: promoLabel,
            discountCents: promoDiscountCents,
            loading: promoLoading,
            error: promoError,
            setError: setPromoError,
            apply: applyPromoCode,
            remove: removePromoCode,
          }}
          carbonOffset={{ enabled: addCarbonOffset, setEnabled: setAddCarbonOffset, cents: CARBON_OFFSET_CENTS }}
          referral={{
            balanceCents: referralBalanceCents,
            apply: applyReferralCredit,
            setApply: setApplyReferralCredit,
            appliedCents: referralCreditAppliedCents,
            previewCents: previewReferralCreditCents,
          }}
        />

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        {/* Payout-fallback: cleaner's payout account isn't ready — save/confirm the card + book. */}
        {step === "summary" && payoutFallback && (
          <PayoutFallbackCard
            loading={loading}
            savedCard={savedCard}
            saveCardSecret={saveCardSecret}
            onBookWithoutCard={() => void bookWithoutCard()}
            onLoadNewCardForm={() => void loadNewCardForm()}
            onCancel={() => setPayoutFallback(false)}
          />
        )}

        {/* Step: summary → show proceed button */}
        {step === "summary" && amounts && !payoutFallback && (
          <div className="space-y-3 mb-6">
            <Button
              onClick={proceedToPayment}
              disabled={loading || !store.acceptedCancellationPolicy || (isConcreteRecurring && !store.acceptedAutoRenewConsent)}
              className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-base"
            >
              {loading ? <><Loader2 size={18} className="animate-spin mr-2" />{t("preparingPayment")}</> : t("continueToPayment")}
            </Button>
            {/* No-card path: booking is created without a hold; the cleaner is warned. Auto-renew
                consent isn't required here — with no card on file, no schedule can be auto-created
                either way, so a recurring client just falls back to the manual setup prompt below. */}
            <Button
              variant="outline"
              onClick={bookWithoutCard}
              disabled={loading || !store.acceptedCancellationPolicy}
              className="w-full h-11 border-[#E5EBF0] text-[#6B7280] hover:text-[#2B3441]"
            >
              {t("bookWithoutCard")}
            </Button>
            <p className="text-xs text-center text-[#9CA3AF]">{t("bookWithoutCardNote")}</p>
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
                    acceptedCancellationPolicy: store.acceptedCancellationPolicy,
                  }}
                  onSuccess={(id, num) => {
                    setSuccess({ bookingId: id, bookingNumber: num })
                    if (isConcreteRecurring && store.acceptedAutoRenewConsent && intentId) {
                      setRecurringSetupResult("pending")
                      void maybeSetupRecurringSchedule(intentId, serviceId).then(setRecurringSetupResult)
                    }
                  }}
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
