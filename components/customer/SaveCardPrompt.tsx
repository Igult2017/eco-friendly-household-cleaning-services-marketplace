"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { CreditCard, CheckCircle2, Loader2 } from "lucide-react"
import { AddCardForm } from "./AddCardForm"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Post-action prompt: save a card (SetupIntent — NO charge) or continue without. Shown after posting
// a job so bidding cleaners know a payment method is on file. Renders nothing if a card already is.
export function SaveCardPrompt({ onSkip, skipLabel }: { onSkip: () => void; skipLabel: string }) {
  const t = useTranslations("compSaveCardPrompt")
  const [state, setState] = useState<"loading" | "prompt" | "form" | "saved" | "hidden">("loading")
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/payments/methods")
      .then((r) => r.json())
      .then((d) => setState((d.cards ?? []).length > 0 ? "hidden" : "prompt"))
      .catch(() => setState("prompt"))
  }, [])

  async function startForm() {
    setState("loading")
    try {
      const r = await fetch("/api/payments/setup-intent", { method: "POST" })
      const d = await r.json()
      if (d.clientSecret) { setClientSecret(d.clientSecret); setState("form") } else { setState("prompt") }
    } catch { setState("prompt") }
  }

  if (state === "hidden") return null
  if (state === "saved") {
    return (
      <div className="w-full max-w-md rounded-2xl border border-[#2D7A5F]/25 bg-[#EDF5F0] p-5 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-[#2D7A5F]"><CheckCircle2 size={16} /> {t("saved")}</p>
      </div>
    )
  }
  return (
    <div className="w-full max-w-md rounded-2xl border border-[#E5EBF0] bg-white p-5 text-left shadow-sm">
      <p className="flex items-center gap-2 font-semibold text-[#2B3441] mb-1"><CreditCard size={16} className="text-[#2D7A5F]" /> {t("title")}</p>
      <p className="text-xs text-[#6B7280] mb-4">{t("body")}</p>
      {state === "loading" && <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#2D7A5F]" /></div>}
      {state === "prompt" && (
        <div className="flex flex-wrap gap-2">
          <button onClick={startForm} className="rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors">
            {t("addCard")}
          </button>
          <button onClick={onSkip} className="rounded-xl border border-[#E5EBF0] px-4 py-2 text-sm text-[#6B7280] hover:text-[#2B3441] transition-colors">
            {skipLabel}
          </button>
        </div>
      )}
      {state === "form" && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#2D7A5F" } } }}>
          <AddCardForm onDone={() => setState("saved")} onCancel={() => setState("prompt")} />
        </Elements>
      )}
    </div>
  )
}
