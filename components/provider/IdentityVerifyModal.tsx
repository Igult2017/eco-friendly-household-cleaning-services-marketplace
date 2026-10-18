"use client"

import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Loader2, Camera, IdCard, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

// The identity check, opened OVER the cleaner's own page. Stripe's pop-up handles the camera, the
// document and the face photo; the cleaner never leaves DORIXÉ, which is the whole point of using
// the client_secret rather than the hosted URL Stripe also offers.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Props {
  /** The job waiting on this check, so the result can release exactly that booking. */
  bookingId?: string
  /** When the job is given away if the check is not done. */
  dueAt?: string | null
  onVerified?: () => void
}

export function IdentityVerifyModal({ bookingId, dueAt, onVerified }: Props) {
  const [busy, setBusy] = useState(false)
  const t = useTranslations("compProviderIdentityCheck")

  async function start() {
    setBusy(true)
    try {
      const stripe = await stripePromise
      if (!stripe) {
        toast.error(t("failedStart"))
        return
      }

      const res = await fetch("/api/stripe/identity/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })
      const data = await res.json().catch(() => ({}))

      if (data?.alreadyVerified) {
        toast.success(t("alreadyDone"))
        onVerified?.()
        return
      }
      if (!res.ok || !data?.clientSecret) {
        // The server's own message is preferred when it has one — it explains the specific reason
        // (attempts used up, for instance), which a generic translated string cannot.
        toast.error(data?.error ?? t("failedStart"))
        return
      }

      // Opens Stripe's pop-up in place. It resolves when the cleaner closes or finishes it — the
      // real pass/fail arrives by webhook afterwards, so this does NOT claim success.
      const result = await stripe.verifyIdentity(data.clientSecret)
      if (result.error) {
        // Closing it early is not a failure worth shouting about; they can reopen it — and now
        // reopening costs nothing, because the same Stripe session is resumed.
        toast.error(result.error.message ?? t("failedStart"))
        return
      }
      // Ask Stripe directly rather than waiting on the webhook. If it already says verified, the
      // hold on this job is released right here — so a webhook that never arrives cannot cost the
      // cleaner the work. Failure is silent on purpose: the webhook and the hourly sweep both
      // still cover it, and nothing is worse for having tried.
      try {
        await fetch("/api/stripe/identity/status", { method: "POST" })
      } catch { /* webhook + sweep remain the backstop */ }
      toast.success(t("submitted"))
      onVerified?.()
    } catch {
      toast.error(t("failedStart"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#2D7A5F]" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-bold text-[#2B3441]">{t("heading")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#2B3441]">{t("intro")}</p>

          <p className="mt-4 text-sm font-semibold text-[#2B3441]">{t("whatYouNeed")}</p>
          <ul className="mt-2 space-y-2 text-sm text-[#2B3441]">
            <li className="flex items-start gap-2">
              <IdCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6B7280]" aria-hidden="true" />
              <span>{t("needId")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Camera className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6B7280]" aria-hidden="true" />
              <span>{t("needSelfie")}</span>
            </li>
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-[#6B7280]">
            {t("tip")}
            {dueAt ? <> {t("dueBy", { when: new Date(dueAt).toLocaleString() })}</> : null}
          </p>

          <button
            onClick={start}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2D7A5F] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#235f49] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? t("opening") : t("button")}
          </button>
        </div>
      </div>
    </div>
  )
}
