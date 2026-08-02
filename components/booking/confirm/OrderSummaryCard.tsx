"use client"

import { useTranslations } from "next-intl"
import { useBookingStore } from "@/stores/bookingStore"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { Loader2, Leaf, Wallet } from "lucide-react"
import { PromoCodeInput } from "./PromoCodeInput"
import { ConsentCheckboxes } from "./ConsentCheckboxes"

// Keys MUST match the real category slugs (see app/(customer)/book/page.tsx SERVICE_CATEGORIES) —
// "move-in-out" never matched the DB's "move-cleaning" slug, so those bookings silently fell back
// to the generic "defaultCleaningService" label below.
const CATEGORY_SERVICE_KEYS: Record<string, string> = {
  "regular-cleaning": "categoryRegularCleaning",
  "deep-cleaning": "categoryDeepCleaning",
  "move-cleaning": "categoryMoveInOut",
  "office-cleaning": "categoryOfficeCleaning",
  "laundry": "categoryLaundry",
  "window-cleaning": "categoryWindowCleaning",
}

interface PromoState {
  code: string
  setCode: (v: string) => void
  codeId: string | null
  label: string | null
  discountCents: number
  loading: boolean
  error: string | null
  setError: (v: string | null) => void
  apply: () => void
  remove: () => void
}

interface CarbonOffsetState {
  enabled: boolean
  setEnabled: (v: boolean) => void
  cents: number
}

interface ReferralState {
  balanceCents: number
  apply: boolean
  setApply: (v: boolean) => void
  appliedCents: number
  previewCents: number
}

interface Props {
  currency: "EUR" | "USD"
  loading: boolean
  amounts: { subtotalCents: number; totalCharged: number } | null
  hourlyRateCents: number | null
  step: "summary" | "payment"
  isConcreteRecurring: boolean
  totalWithOffset: number | null
  promo: PromoState
  carbonOffset: CarbonOffsetState
  referral: ReferralState
}

export function OrderSummaryCard({ currency, loading, amounts, hourlyRateCents, step, isConcreteRecurring, totalWithOffset, promo, carbonOffset, referral }: Props) {
  const t = useTranslations("customerBookConfirmPage")
  const store = useBookingStore()

  return (
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
          {/* Per-hour breakdown — the client always sees the amount they pay per hour. */}
          {hourlyRateCents !== null && (
            <p className="text-xs text-[#9CA3AF] -mt-1">
              {t("rateBreakdown", { rate: formatCurrency(hourlyRateCents, currency), hours: store.durationMinutes % 60 === 0 ? String(store.durationMinutes / 60) : (store.durationMinutes / 60).toFixed(1) })}
            </p>
          )}

          {/* Promo code input */}
          {step === "summary" && <PromoCodeInput currency={currency} {...promo} />}

          {/* Carbon offset toggle */}
          <div className="border-t border-[#E5EBF0] my-2" />
          <label className={`flex items-center justify-between cursor-pointer rounded-xl px-3 py-2.5 transition-colors ${carbonOffset.enabled ? "bg-[#F4FAF6] border border-[#2D7A5F]/30" : "hover:bg-gray-50"}`}>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={carbonOffset.enabled}
                onChange={(e) => carbonOffset.setEnabled(e.target.checked)}
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
            <span className="text-[#6B7280] font-medium">{carbonOffset.enabled ? formatCurrency(carbonOffset.cents, currency) : "—"}</span>
          </label>

          {/* Referral discount balance toggle — only shown when the client actually has one */}
          {referral.balanceCents > 0 && (
            <>
              <div className="border-t border-[#E5EBF0] my-2" />
              <label className={`flex items-center justify-between cursor-pointer rounded-xl px-3 py-2.5 transition-colors ${referral.apply ? "bg-[#F4FAF6] border border-[#2D7A5F]/30" : "hover:bg-gray-50"}`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={referral.apply}
                    onChange={(e) => referral.setApply(e.target.checked)}
                    disabled={step === "payment"}
                    className="h-4 w-4 accent-[#2D7A5F] rounded"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Wallet size={13} className="text-[#2D7A5F]" />
                      <span className="text-[#2B3441] font-medium">{t("useReferralBalance")}</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">{t("referralBalanceAvailable", { amount: formatCurrency(referral.balanceCents, currency) })}</p>
                  </div>
                </div>
                <span className="text-[#2D7A5F] font-semibold">
                  {referral.apply ? `-${formatCurrency(step === "payment" ? referral.appliedCents : referral.previewCents, currency)}` : "—"}
                </span>
              </label>
            </>
          )}

          <div className="border-t border-[#E5EBF0] my-2" />
          <div className="flex justify-between font-bold text-[#2B3441] text-base">
            <span>{t("totalChargedToday")}</span>
            <span className="text-[#2D7A5F]">{formatCurrency(totalWithOffset ?? amounts.totalCharged, currency)}</span>
          </div>
          <p className="text-xs text-[#9CA3AF]">{t("preAuthNote")}</p>

          {step === "summary" && <ConsentCheckboxes isConcreteRecurring={isConcreteRecurring} />}
        </div>
      ) : null}
    </div>
  )
}
