"use client"

import { BookOpen } from "lucide-react"
import { Config, euros } from "./shared"

// Plain-English reference for what each setting above actually does, with the money worked out from
// whatever is currently on screen (including unsaved edits), so the examples never drift from the
// real numbers.
export function SettingsManual({ cfg }: { cfg: Config }) {
  const commission = parseInt(cfg.commission_pct ?? "45") || 0
  const regular = parseInt(cfg.commission_regular_pct ?? "33") || 0
  const recurringPct = parseInt(cfg.recurring_discount_pct ?? "10") || 0

  const subtotal = 100
  const platformFee = Math.round(subtotal * commission / 100)
  const cleanerReceives = subtotal - platformFee
  const recurringDiscountRaw = Math.round(subtotal * recurringPct / 100)
  const recurringDiscountCapped = Math.min(recurringDiscountRaw, platformFee)
  const netPlatformFeeRecurring = platformFee - recurringDiscountCapped
  const clientPaysRecurring = subtotal - recurringDiscountCapped

  const promoDiscount = 10
  const subtotalAfterPromo = subtotal - promoDiscount
  const platformFeeAfterPromo = Math.round(subtotalAfterPromo * commission / 100)
  const cleanerReceivesAfterPromo = subtotalAfterPromo - platformFeeAfterPromo
  const cleanerLossFromPromo = cleanerReceives - cleanerReceivesAfterPromo
  const platformLossFromPromo = platformFee - platformFeeAfterPromo

  return (
    <details className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <summary className="cursor-pointer select-none px-6 py-5 flex items-center gap-3 text-sm font-semibold text-[#2B3441]">
        <BookOpen size={16} className="text-[#2D7A5F]" />
        What each setting does — the money math explained
      </summary>

      <div className="px-6 pb-6 space-y-6 text-sm text-[#2B3441]">

        <div>
          <p className="font-semibold mb-1">Platform Commission %</p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            The customer always pays the cleaner&apos;s posted rate — nothing is ever added on top.
            This percentage is instead <em>deducted from the cleaner&apos;s payout</em>: think of it as
            the cleaner renting the platform to reach clients. There are two rates because a client who
            comes back every week is worth far more to the platform than a one-off, and the cleaner
            should see that: on a €{subtotal} job a one-off leaves the cleaner €{cleanerReceives}, while
            an established regular leaves them €{subtotal - regular}. Which rate a booking gets is
            decided in{" "}
            <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">lib/platform/commissionTier.ts</code>{" "}
            and then stored on the booking, so a later change never alters a booking already made.
          </p>
        </div>

        <div>
          <p className="font-semibold mb-1">Minimum Hourly Rate</p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            A wage floor, not a price cap. Neither a client posting a job at an hourly rate, nor a
            cleaner listing their own hourly service price, is allowed to go below this number —
            it protects cleaners from being undercut into an unsustainable rate. Currently{" "}
            {euros(cfg.min_hourly_rate_cents, 1800)} an hour.
          </p>
        </div>

        <div>
          <p className="font-semibold mb-2">Where discounts and rewards actually come from</p>
          <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
            <strong>The recurring discount and every referral reward come ONLY out of the
            platform&apos;s own commission — they never touch what the cleaner is paid,</strong> and the
            discount is capped so it can never exceed the commission itself. On a €{subtotal} job at
            your current {commission}% commission and {recurringPct}% recurring discount:
          </p>
          <div className="bg-[#F4FAF6] rounded-xl px-4 py-3 text-xs space-y-1 mb-3">
            <p>Full price: platform keeps <span className="font-semibold">€{platformFee}</span> ({commission}%), cleaner receives <span className="font-semibold">€{cleanerReceives}</span></p>
            <p>With the {recurringPct}% discount: client pays <span className="font-semibold">€{clientPaysRecurring}</span>, cleaner STILL receives <span className="font-semibold text-[#2D7A5F]">€{cleanerReceives}</span> (unchanged), platform keeps only <span className="font-semibold">€{netPlatformFeeRecurring}</span></p>
            {recurringDiscountRaw > platformFee && (
              <p className="text-amber-700">Note: a {recurringPct}% discount would exceed the {commission}% commission, so it is capped at €{recurringDiscountCapped} — raise commission if you want the full {recurringPct}% to reach clients.</p>
            )}
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
            <strong>Promo codes and spending a referral balance at checkout work differently</strong> —
            that discount comes off the price BEFORE the commission split, so it is shared proportionally
            between the platform and the cleaner. On the same €{subtotal} job with a €{promoDiscount}
            {" "}promo code or credit applied:
          </p>
          <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs space-y-1">
            <p>Client pays <span className="font-semibold">€{subtotalAfterPromo}</span> (correct — €{promoDiscount} off)</p>
            <p>Cleaner receives <span className="font-semibold">€{cleanerReceivesAfterPromo}</span> — <span className="font-semibold text-amber-700">€{cleanerLossFromPromo} LESS</span> than the full-price €{cleanerReceives}</p>
            <p>Platform keeps <span className="font-semibold">€{platformFeeAfterPromo}</span> — €{platformLossFromPromo} less than usual</p>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed mt-2">
            In other words: the cleaner absorbs most of a promo-code or credit discount, in proportion to
            their own share of the price. That is a real difference between the two mechanisms, not a bug —
            whether it should stay that way is a product decision, not something this page silently changes.
            Code paths: recurring/referral —{" "}
            <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">calculateDiscountedBookingAmounts()</code>;
            promo/credit — <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">app/api/payments/intent/route.ts</code>.
          </p>
        </div>

        <div>
          <p className="font-semibold mb-1">Referral reward vs Affiliate Programme</p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Two different things that are easy to confuse. The <strong>referral reward</strong> is a flat
            amount paid <em>once</em>, when someone you invited reaches the job threshold — it does not
            repeat. The <strong>affiliate programme</strong> is a percentage of <em>every</em> booking the
            affiliate introduces, ongoing, which is what the public /affiliate page sells. An affiliate
            signs up with the role &quot;affiliate&quot;; everyone else falls under the flat reward.
          </p>
        </div>

        <div>
          <p className="font-semibold mb-1">Default Payout Schedule</p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Sets how often a cleaner&apos;s payout account pays into their bank, applied when that
            account is first created (<code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">lib/stripe/connect.ts</code>).
            Only Weekly or Monthly are supported — not bi-weekly. Changing it only affects cleaners set
            up AFTER the change; it does not move existing cleaners onto a new schedule.
          </p>
        </div>

        <div>
          <p className="font-semibold mb-1">Maximum Service Radius</p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            The hard ceiling on how far a cleaner can set their own service area. Enforced live wherever
            a cleaner saves their profile or completes onboarding.
          </p>
        </div>

        <div>
          <p className="font-semibold mb-1">Cancellation &amp; No-Show Policy</p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            A ladder based on how close to the job a cancellation happens — further out, free; closer in,
            a share of the price; in the last hours, the full fee plus a flat travel payment straight to
            the cleaner, who may already have travelled. <strong>It applies to cleaners too</strong>: a
            cleaner who drops a job late owes the same amount, except that nothing is taken from the
            client (they are always refunded in full) and nothing is taken from the cleaner automatically
            either — a cleaner has no card on file and each job pays them directly, so there is no payout
            batch to deduct from. The amount is recorded against them and an admin is alerted. Their
            reliability score also falls on its own. Illness and strike / transport failure waive the fee
            for either side at any notice. The grace period is how long either party must wait past the
            scheduled start before reporting the other as a no-show, so normal lateness cannot be
            reported instantly.
          </p>
        </div>

      </div>
    </details>
  )
}
