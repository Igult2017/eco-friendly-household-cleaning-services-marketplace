"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, CreditCard, Plus } from "lucide-react"

type Card = { id: string; brand: string; last4: string; expMonth: number; expYear: number }
type Freq = "weekly" | "biweekly" | "monthly"

const DAYS = ["daySunday", "dayMonday", "dayTuesday", "dayWednesday", "dayThursday", "dayFriday", "daySaturday"]
const FREQS: Freq[] = ["weekly", "biweekly", "monthly"]

interface Props {
  providerId: string
  serviceId: string
  businessName: string
  serviceName: string
  serviceAddress: Record<string, unknown>
  ecoOptions: string[]
  specialInstructions: string
  timezone: string
  initialFrequency: Freq
  initialDayOfWeek: number
  initialTime: string
}

export function RecurringSetupForm(props: Props) {
  const t = useTranslations("customerRecurringNewPage")
  const router = useRouter()
  const [frequency, setFrequency] = useState<Freq>(props.initialFrequency)
  const [dayOfWeek, setDayOfWeek] = useState(props.initialDayOfWeek)
  const [preferredTime, setPreferredTime] = useState(props.initialTime || "09:00")
  const [cards, setCards] = useState<Card[]>([])
  const [cardsLoaded, setCardsLoaded] = useState(false)
  const [pmId, setPmId] = useState("")
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/payments/methods")
      .then((r) => r.json())
      .then((d) => { const list: Card[] = d.cards ?? []; setCards(list); setPmId(d.defaultId ?? list[0]?.id ?? ""); setCardsLoaded(true) })
      .catch(() => setCardsLoaded(true))
  }, [])

  async function submit() {
    setError("")
    if (!pmId) { setError(t("noCardError")); return }
    if (!consent) { setError(t("consentError")); return }
    setSubmitting(true)
    const addr = Object.fromEntries(Object.entries(props.serviceAddress).filter(([, v]) => typeof v === "string" && v))
    const res = await fetch("/api/recurring", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: props.providerId, serviceId: props.serviceId, frequency, dayOfWeek, preferredTime,
        serviceAddress: addr, ecoOptions: props.ecoOptions, specialInstructions: props.specialInstructions || undefined,
        paymentMethodId: pmId, timezone: props.timezone, autoRenewConsent: true,
      }),
    })
    setSubmitting(false)
    if (res.ok) { router.push("/recurring") } else { const d = await res.json().catch(() => ({})); setError(d.error ?? t("genericError")) }
  }

  const selectClass = "w-full rounded-xl border border-[#E5EBF0] bg-white px-3 py-2.5 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] flex items-center gap-2">
          <RefreshCw size={22} className="text-[#2D7A5F]" />{t("title")}
        </h1>
        <p className="text-[#6B7280] text-sm mt-1 mb-6">{t("subtitle", { service: props.serviceName, business: props.businessName })}</p>

        <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("frequencyLabel")}</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Freq)} className={selectClass}>
              {FREQS.map((f) => <option key={f} value={f}>{t(`freq_${f}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("dayLabel")}</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className={selectClass}>
              {DAYS.map((d, i) => <option key={d} value={i}>{t(d)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("timeLabel")}</label>
            <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={selectClass} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">{t("cardLabel")}</label>
            {!cardsLoaded ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#2D7A5F]" />
            ) : cards.length === 0 ? (
              <Link href="/payments" className="flex items-center gap-2 rounded-xl border border-dashed border-[#2D7A5F]/40 px-4 py-3 text-sm text-[#2D7A5F] hover:bg-[#F4FAF6]">
                <Plus size={15} /> {t("addCard")}
              </Link>
            ) : (
              <div className="space-y-2">
                {cards.map((c) => (
                  <label key={c.id} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer ${pmId === c.id ? "border-[#2D7A5F] bg-[#F4FAF6]" : "border-[#E5EBF0]"}`}>
                    <input type="radio" name="pm" checked={pmId === c.id} onChange={() => setPmId(c.id)} className="accent-[#2D7A5F]" />
                    <CreditCard size={15} className="text-[#6B7280]" />
                    <span className="text-sm text-[#2B3441] capitalize">{c.brand} •••• {c.last4}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl bg-[#F4FAF6] p-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#2D7A5F]" />
            <span className="text-xs text-[#6B7280]">{t("consentLabel")}</span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={submit} disabled={submitting || !cardsLoaded} className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  )
}
