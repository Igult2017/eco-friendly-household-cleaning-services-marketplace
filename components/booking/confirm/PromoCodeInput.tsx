"use client"

import { useTranslations } from "next-intl"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { Loader2, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  currency: "EUR" | "USD"
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

export function PromoCodeInput({ currency, code, setCode, codeId, label, discountCents, loading, error, setError, apply, remove }: Props) {
  const t = useTranslations("customerBookConfirmPage")

  return (
    <>
      <div className="border-t border-[#E5EBF0] my-2" />
      {codeId ? (
        <div className="flex items-center justify-between rounded-xl bg-[#F4FAF6] border border-[#2D7A5F]/30 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-[#2D7A5F]" />
            <span className="text-[#2B3441] font-medium">{label}</span>
            <span className="text-xs text-[#2D7A5F]">{t("promoApplied")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#2D7A5F] font-semibold">-{formatCurrency(discountCents, currency)}</span>
            <button onClick={remove} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label={t("removePromoAria")}>
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder={t("promoPlaceholder")}
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="h-9 text-sm border-[#E5EBF0] focus-visible:ring-[#2D7A5F]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={apply}
            disabled={loading || !code.trim()}
            className="h-9 px-4 border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#F4FAF6] shrink-0"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : t("apply")}
          </Button>
        </div>
      )}
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </>
  )
}
