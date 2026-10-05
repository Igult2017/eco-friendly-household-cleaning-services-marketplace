"use client"

import { useTranslations } from "next-intl"
import { HeartPulse, TrainFront, CircleHelp } from "lucide-react"
import { CANCELLATION_REASON_CATEGORIES, isWaivedReason, type CancellationReasonCategory } from "@/lib/utils/cancellationReasons"

const ICONS: Record<CancellationReasonCategory, typeof HeartPulse> = {
  illness: HeartPulse,
  transport: TrainFront,
  other: CircleHelp,
}

// Why the booking is being cancelled, as a category rather than free text. Illness and strike /
// transport failure waive the cancellation fee at any notice — the server decides that from this
// value (lib/utils/refunds.ts WAIVED_REASONS), so a made-up value here can never buy a free
// cancellation. Shared by all three cancel screens (client page, cleaner cancel, cleaner reject) so
// the wording and the waiver rule can never drift apart between them.
export function CancellationReasonPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: CancellationReasonCategory
  onChange: (v: CancellationReasonCategory) => void
  disabled?: boolean
  compact?: boolean
}) {
  const t = useTranslations("compCancellationReasonPicker")

  return (
    <fieldset className="mb-4" disabled={disabled}>
      <legend className={`font-medium text-[#2B3441] mb-2 ${compact ? "text-xs" : "text-sm"}`}>
        {t("legend")}
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {CANCELLATION_REASON_CATEGORIES.map((c) => {
          const Icon = ICONS[c]
          const selected = value === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={selected}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D7A5F]/40 disabled:opacity-50 ${
                compact ? "text-xs" : "text-sm"
              } ${
                selected
                  ? "border-[#2D7A5F] bg-[#F4FAF6] text-[#2B3441] font-semibold"
                  : "border-gray-200 bg-white text-[#6B7280] hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <Icon size={compact ? 13 : 15} className={selected ? "text-[#2D7A5F]" : "text-[#9CA3AF]"} aria-hidden="true" />
              {t(`option_${c}`)}
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-[#6B7280] ${compact ? "text-[11px]" : "text-xs"}`}>
        {isWaivedReason(value) ? t("hintWaived") : t("hintFee")}
      </p>
    </fieldset>
  )
}
