"use client"

import { useTranslations } from "next-intl"
import { useBookingStore } from "@/stores/bookingStore"

interface Props {
  isConcreteRecurring: boolean
}

// Cancellation-policy consent is always required; auto-renew consent only applies to a concrete
// recurring cadence (weekly/biweekly/monthly) — see confirm/page.tsx's isConcreteRecurring for why
// bid-flow's ambiguous "recurring" value never shows this second checkbox.
export function ConsentCheckboxes({ isConcreteRecurring }: Props) {
  const t = useTranslations("customerBookConfirmPage")
  const store = useBookingStore()

  return (
    <>
      <div className="border-t border-[#E5EBF0] my-2" />
      <label className="flex items-start gap-2.5 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={store.acceptedCancellationPolicy}
          onChange={(e) => store.setAcceptedCancellationPolicy(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#2D7A5F] rounded shrink-0"
        />
        <span className="text-xs text-[#6B7280] leading-relaxed">
          {t.rich("acceptCancellationPolicy", {
            link: (chunks) => (
              <a href="/legal/terms#cancellation-policy" target="_blank" className="text-[#2D7A5F] underline">{chunks}</a>
            ),
          })}
        </span>
      </label>
      {isConcreteRecurring && (
        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={store.acceptedAutoRenewConsent}
            onChange={(e) => store.setAcceptedAutoRenewConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#2D7A5F] rounded shrink-0"
          />
          <span className="text-xs text-[#6B7280] leading-relaxed">
            {t("autoRenewConsentLabel")}
          </span>
        </label>
      )}
    </>
  )
}
