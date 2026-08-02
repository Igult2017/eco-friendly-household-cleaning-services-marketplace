"use client"

import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type RecurringSetupResult = "pending" | "success" | "failed" | "skipped" | null

interface Props {
  bookingNumber: string
  frequency: string // BookingDraft["frequency"] — "one_time" hides the recurring panel entirely
  isConcreteRecurring: boolean
  recurringSetupResult: RecurringSetupResult
  onSetUpRecurring: () => void
  onGoToBookings: () => void
}

export function BookingSuccessScreen({ bookingNumber, frequency, isConcreteRecurring, recurringSetupResult, onSetUpRecurring, onGoToBookings }: Props) {
  const t = useTranslations("customerBookConfirmPage")

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-20 px-4 flex flex-col items-center justify-center">
      <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 size={40} className="text-[#2D7A5F]" />
      </div>
      <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">{t("bookingConfirmedTitle")}</h1>
      <p className="text-[#6B7280] text-center mb-2">{t("bookingNumberLabel")} <strong className="text-[#2B3441]">{bookingNumber}</strong></p>
      <p className="text-sm text-[#6B7280] text-center mb-6 max-w-sm">
        {t("confirmationEmailNote")}
      </p>
      {frequency !== "one_time" && (
        <div className="mb-6 max-w-sm w-full rounded-xl border border-[#2D7A5F]/20 bg-[#EDF5F0] px-5 py-4 text-center">
          {isConcreteRecurring && recurringSetupResult === "success" ? (
            <>
              <p className="text-sm font-semibold text-[#2B3441] mb-1">{t("recurringAutoSetTitle")}</p>
              <p className="text-xs text-[#6B7280]">{t("recurringAutoSetText")}</p>
            </>
          ) : isConcreteRecurring && recurringSetupResult === "pending" ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#6B7280]">
              <Loader2 size={14} className="animate-spin" />
              {t("recurringSettingUp")}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#2B3441] mb-1">{t("recurringPromptTitle")}</p>
              <p className="text-xs text-[#6B7280] mb-3">
                {recurringSetupResult === "failed" || recurringSetupResult === "skipped" ? t("recurringAutoSetFailed") : t("recurringPromptText")}
              </p>
              <Button onClick={onSetUpRecurring} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white h-9 text-sm">
                {t("setUpRecurring")}
              </Button>
            </>
          )}
        </div>
      )}
      <Button onClick={onGoToBookings} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white px-8 h-11">
        {t("goToMyBookings")}
      </Button>
    </div>
  )
}
