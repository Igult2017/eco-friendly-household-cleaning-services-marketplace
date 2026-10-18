"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CreditCard, CheckCircle, Clock } from "lucide-react"
import { StripeConnectEmbed } from "./StripeConnectEmbed"

// Surfaces the cleaner's Stripe Connect payout setup. Shown on the earnings page (always) and the
// dashboard (only when there is still something to do). A cleaner cannot be paid — and customers
// can't even be charged (destination charges) — until this is "active". The onboarding form itself
// renders inline via Stripe's embedded component (StripeConnectEmbed) — no redirect off the site.
//
// Three states, because "pending" means the cleaner ALREADY submitted their bank details and Stripe
// is reviewing them. Showing them the "Add information to start accepting money" form again reads
// as "you have done nothing", which is wrong and is what prompted this split. The API routes
// already drew this distinction (app/api/jobs/[id]/take, .../bids/[bidId]/accept) — the card didn't.
export function PayoutConnect({ status }: { status: string | null }) {
  const t = useTranslations("compOnboardingProviderPayoutStep")
  const router = useRouter()

  // stripeAccountStatus is only ever "active" | "pending" | "incomplete" (see lib/stripe/connect.ts
  // getConnectAccountStatus) — "charges_enabled" was never a real value this could hold.
  const active = status === "active"
  const underReview = status === "pending"

  if (active) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800 text-sm">{t("successTitle")}</p>
          <p className="text-xs text-green-700">{t("successDescription")}</p>
        </div>
      </div>
    )
  }

  // Details are in and Stripe is checking them. No form — there is nothing left for them to fill in,
  // and re-showing it would just invite a pointless second submission.
  if (underReview) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900 text-sm">{t("reviewTitle")}</p>
          <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">{t("reviewDescription")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#2B3441] text-sm">{t("title")}</p>
          <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{t("description")}</p>
        </div>
      </div>
      <StripeConnectEmbed onConnected={() => router.refresh()} />
    </div>
  )
}
