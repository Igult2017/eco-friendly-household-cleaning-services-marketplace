"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard } from "lucide-react"
import { BackButton } from "@/components/ui/BackButton"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PayForm({ bookingId, paymentIntentId }: { bookingId: string; paymentIntentId: string }) {
  const t = useTranslations("customerBookingPayPage")
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/bookings/${bookingId}/pay` },
      redirect: "if_required",
    })
    const alreadyAuthorized = stripeError?.code === "payment_intent_unexpected_state" && stripeError.payment_intent?.status === "requires_capture"
    if (stripeError && !alreadyAuthorized) { setError(stripeError.message ?? t("errorGeneric")); setBusy(false); return }
    const r = await fetch(`/api/bookings/${bookingId}/pay`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentIntentId }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? t("errorGeneric")); setBusy(false); return }
    router.push(`/bookings/${bookingId}`)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={busy || !stripe} className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold">
        {busy ? <Loader2 size={16} className="animate-spin" /> : t("secureButton")}
      </Button>
      <p className="text-xs text-center text-[#9CA3AF]">{t("holdNote")}</p>
    </form>
  )
}

// Add a payment method to a booking made without one. Places the same manual-capture hold as a
// normal booking (card saved) — the cleaner can only take the order once this is done.
export default function BookingPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations("customerBookingPayPage")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // 3DS return: the redirect brings ?payment_intent=…&redirect_status=succeeded → just attach.
    const qs = new URLSearchParams(window.location.search)
    const piId = qs.get("payment_intent")
    if (piId && qs.get("redirect_status") === "succeeded") {
      fetch(`/api/bookings/${id}/pay`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentIntentId: piId }) })
        .then((r) => { if (r.ok) router.push(`/bookings/${id}`) })
      return
    }
    fetch(`/api/bookings/${id}/pay`, { method: "POST" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error ?? t("errorGeneric")); return }
        setClientSecret(d.clientSecret)
        setPaymentIntentId(d.paymentIntentId)
      })
      .catch(() => setError(t("errorGeneric")))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <div className="mb-3"><BackButton fallback={`/bookings/${id}`} /></div>
      <h1 className="font-serif text-2xl font-bold text-[#2B3441] flex items-center gap-2 mb-1">
        <CreditCard size={22} className="text-[#2D7A5F]" /> {t("title")}
      </h1>
      <p className="text-sm text-[#6B7280] mb-6">{t("subtitle")}</p>
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-5">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : clientSecret && paymentIntentId ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#2D7A5F" } } }}>
            <PayForm bookingId={id} paymentIntentId={paymentIntentId} />
          </Elements>
        ) : (
          <div className="flex items-center justify-center gap-2 py-8 text-[#6B7280]">
            <Loader2 size={18} className="animate-spin text-[#2D7A5F]" /> {t("preparing")}
          </div>
        )}
      </div>
    </div>
  )
}
