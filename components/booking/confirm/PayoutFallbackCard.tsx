"use client"

import { useTranslations } from "next-intl"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { AddCardForm } from "@/components/customer/AddCardForm"
import { Loader2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Props {
  loading: boolean
  savedCard: { brand: string; last4: string } | null
  saveCardSecret: string | null
  onBookWithoutCard: () => void
  onLoadNewCardForm: () => void
  onCancel: () => void
}

// Cleaner's payout account isn't ready — save/confirm the card + book anyway (see confirm/page.tsx's
// startPayoutFallback for why: the client's card guarantee is independent of the cleaner's payout setup).
export function PayoutFallbackCard({ loading, savedCard, saveCardSecret, onBookWithoutCard, onLoadNewCardForm, onCancel }: Props) {
  const t = useTranslations("customerBookConfirmPage")

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6 space-y-3">
      <p className="text-sm font-semibold text-[#2B3441]">{t("payoutFallbackTitle")}</p>
      <p className="text-xs text-[#6B7280]">{t("payoutFallbackBody")}</p>
      {savedCard ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#E5EBF0] bg-[#F4FAF6] px-3 py-2.5 text-sm text-[#2B3441]">
            <CreditCard size={16} className="text-[#2D7A5F]" />
            <span className="capitalize">{savedCard.brand}</span>
            <span>•••• {savedCard.last4}</span>
          </div>
          <Button onClick={onBookWithoutCard} disabled={loading} className="w-full h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold">
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" />{t("preparingPayment")}</> : t("confirmBookingRequest")}
          </Button>
          <button type="button" onClick={onLoadNewCardForm} disabled={loading} className="w-full text-center text-xs text-[#6B7280] underline hover:text-[#2B3441] transition-colors">
            {t("useDifferentCard")}
          </button>
        </div>
      ) : saveCardSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret: saveCardSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#2D7A5F" } } }}>
          <AddCardForm onDone={onBookWithoutCard} onCancel={onCancel} />
        </Elements>
      ) : (
        <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-[#2D7A5F]" /></div>
      )}
    </div>
  )
}
