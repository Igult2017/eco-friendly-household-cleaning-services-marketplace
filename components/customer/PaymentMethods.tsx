"use client"

import { useState, useEffect, useCallback } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { useTranslations } from "next-intl"
import { CreditCard, Plus, Loader2, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddCardForm } from "./AddCardForm"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Card = { id: string; brand: string; last4: string; expMonth: number; expYear: number }

export function PaymentMethods() {
  const t = useTranslations("customerPaymentMethods")
  const [cards, setCards] = useState<Card[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/payments/methods")
      const d = await r.json()
      setCards(d.cards ?? [])
      setDefaultId(d.defaultId ?? null)
    } catch {
      /* leave empty */
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function startAdd() {
    const r = await fetch("/api/payments/setup-intent", { method: "POST" })
    const d = await r.json()
    if (d.clientSecret) setClientSecret(d.clientSecret)
  }
  async function act(action: "detach" | "setDefault", paymentMethodId: string) {
    setBusy(paymentMethodId)
    try {
      await fetch("/api/payments/methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, paymentMethodId }),
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-[#E5EBF0] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#2B3441] flex items-center gap-2"><CreditCard size={16} className="text-[#2D7A5F]" /> {t("title")}</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">{t("subtitle")}</p>
        </div>
        {!clientSecret && (
          <Button onClick={startAdd} size="sm" className="bg-[#2D7A5F] hover:bg-[#235f49] text-white shrink-0">
            <Plus size={15} className="mr-1" /> {t("addCard")}
          </Button>
        )}
      </div>

      <div className="p-6">
        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#2D7A5F" } } }}>
            <AddCardForm onDone={() => { setClientSecret(null); load() }} onCancel={() => setClientSecret(null)} />
          </Elements>
        ) : loading ? (
          <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[#2D7A5F]" /></div>
        ) : cards.length === 0 ? (
          <p className="text-sm text-center text-[#9CA3AF] py-4">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#E5EBF0] px-4 py-3">
                <CreditCard size={18} className="text-[#6B7280] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2B3441] capitalize">{c.brand} •••• {c.last4}</p>
                  <p className="text-xs text-[#9CA3AF]">{t("expires", { date: `${String(c.expMonth).padStart(2, "0")}/${c.expYear}` })}</p>
                </div>
                {defaultId === c.id ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D1F0E0] px-2.5 py-0.5 text-xs font-semibold text-[#2D7A5F] shrink-0"><Star size={10} /> {t("default")}</span>
                ) : (
                  <button onClick={() => act("setDefault", c.id)} disabled={busy === c.id} className="text-xs font-medium text-[#2D7A5F] hover:underline disabled:opacity-50 shrink-0">{t("setDefault")}</button>
                )}
                <button onClick={() => act("detach", c.id)} disabled={busy === c.id} className="text-[#9CA3AF] hover:text-red-500 disabled:opacity-50 shrink-0" aria-label={t("remove")}>
                  {busy === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
