"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Loader2, Tag, AlertTriangle, ArrowRight } from "lucide-react"
import { formatCurrencyShort, priceUnitSuffix } from "@/lib/utils/formatCurrency"

type Svc = {
  id: string
  name: string
  categoryName: string | null
  basePrice: number
  priceUnit: string
  isActive: boolean
}

// Pricing panel on the provider profile. The booking flow charges a provider's
// per-category service rate (provider_services), so this surfaces those rates —
// and nudges cleaners who have none, since they can't be booked without one.
export function PricingSummaryCard() {
  const t = useTranslations("compProviderPricing")
  const [services, setServices] = useState<Svc[] | null>(null)

  useEffect(() => {
    fetch("/api/provider/services")
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d.services) ? d.services : []))
      .catch(() => setServices([]))
  }, [])

  const active = (services ?? []).filter((s) => s.isActive)

  return (
    <div className="rounded-xl bg-white shadow-sm p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#2B3441]">
            <Tag size={15} className="text-[#2D7A5F]" /> {t("title")}
          </h2>
          <p className="text-xs text-[#6B7280] mt-1">{t("description")}</p>
        </div>
        <Link
          href="/provider/profile/services"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#2D7A5F] hover:underline"
        >
          {t("manageButton")} <ArrowRight size={13} />
        </Link>
      </div>

      {services === null ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#2D7A5F]" /></div>
      ) : active.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{t("empty")}</p>
            <Link
              href="/provider/profile/services"
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#2D7A5F] px-3 py-1.5 font-semibold text-white hover:bg-[#256349] transition-colors"
            >
              {t("setButton")} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {active.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#2B3441] truncate">{s.name}</p>
                {s.categoryName && <p className="text-xs text-[#6B7280]">{s.categoryName}</p>}
              </div>
              <p className="shrink-0 text-sm font-bold text-[#2D7A5F]">
                {formatCurrencyShort(s.basePrice)}
                <span className="text-[11px] font-medium text-[#6B7280]">{priceUnitSuffix[s.priceUnit] ?? ""}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
