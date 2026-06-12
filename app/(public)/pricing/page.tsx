import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, XCircle, ArrowRight, Euro, ShieldCheck, Leaf, Zap } from "lucide-react"

export const metadata: Metadata = {
  title: "Pricing — DORIXÉ",
  description: "Transparent pricing for customers and cleaners. Customers pay a 15% platform fee on top. Cleaners keep 100% of their rate.",
}

const CUSTOMER_FEATURES = [
  "Browse and book eco-certified cleaners",
  "Pre-authorised payment — only captured on completion",
  "Built-in dispute resolution",
  "5-star review system",
  "Job posting + bidding marketplace",
  "Referral credit programme",
  "Cancellation protection (tiered refund)",
  "Real-time notifications",
]

const PROVIDER_FEATURES = [
  "Free profile and listing",
  "Weekly automatic payouts via Stripe",
  "Job alerts in your service area",
  "Bid on posted jobs",
  "Earnings dashboard",
  "Eco certification badge",
  "Zero subscription or monthly fee",
]

const COMPARISON = [
  { feature: "Provider keeps 100% of their rate",  dorixe: true,  competitor: false },
  { feature: "No monthly subscription for cleaners", dorixe: true,  competitor: false },
  { feature: "Eco-certified provider network",       dorixe: true,  competitor: false },
  { feature: "Job marketplace + bidding",            dorixe: true,  competitor: false },
  { feature: "Pre-auth payment (captured on done)",  dorixe: true,  competitor: false },
  { feature: "Built-in dispute resolution",          dorixe: true,  competitor: true  },
  { feature: "Instant payout option",               dorixe: false, competitor: true  },
]

export default function PricingPage() {
  return (
    <div className="bg-[#F4FAF6] min-h-screen">

      {/* Hero */}
      <section className="bg-[#2B3441] text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2D7A5F]/30 border border-[#2D7A5F]/40 px-4 py-1 text-xs font-semibold text-[#4CB87A] uppercase tracking-wide">
            <Euro size={11} /> Transparent Pricing
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white leading-tight">
            Simple, honest fees.<br />No surprises.
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Customers pay a small platform fee. Cleaners keep every cent of their quoted rate. That&apos;s it.
          </p>
        </div>
      </section>

      {/* Two pricing cards */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">

          {/* Customer card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-[#2B3441] px-6 py-8 text-white">
              <div className="w-10 h-10 rounded-xl bg-[#2D7A5F] flex items-center justify-center mb-4">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <h2 className="font-serif text-2xl font-bold mb-1">For Customers</h2>
              <p className="text-white/60 text-sm">Book trusted, eco-certified cleaners</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-bold">15%</span>
                <span className="text-white/60 mb-1.5 text-sm">platform fee</span>
              </div>
              <p className="text-white/50 text-xs mt-1">Added on top of the provider&apos;s price at checkout</p>
            </div>
            <div className="px-6 py-6 space-y-3">
              {CUSTOMER_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <CheckCircle2 size={15} className="text-[#2D7A5F] shrink-0" />
                  <span className="text-sm text-[#2B3441]">{f}</span>
                </div>
              ))}
              <div className="pt-4">
                <div className="bg-[#F4FAF6] rounded-xl px-4 py-4 text-sm space-y-2">
                  <p className="font-semibold text-[#2B3441] text-xs uppercase tracking-wide">Example booking</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Cleaner&apos;s rate</span>
                    <span className="font-medium text-[#2B3441]">€80</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Platform fee (15%)</span>
                    <span className="font-medium text-[#2B3441]">€12</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                    <span className="text-[#2B3441]">You pay total</span>
                    <span className="text-[#2D7A5F]">€92</span>
                  </div>
                </div>
              </div>
              <Link
                href="/book"
                className="block w-full text-center mt-4 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
              >
                Book a cleaner →
              </Link>
            </div>
          </div>

          {/* Cleaner card */}
          <div className="bg-white rounded-2xl border border-[#2D7A5F] shadow-sm overflow-hidden ring-1 ring-[#2D7A5F]/30">
            <div className="bg-gradient-to-br from-[#2D7A5F] to-[#1a5a43] px-6 py-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Leaf size={18} className="text-white" />
                </div>
                <span className="text-xs font-bold bg-white/20 rounded-full px-3 py-1">Most popular</span>
              </div>
              <h2 className="font-serif text-2xl font-bold mb-1">For Cleaners</h2>
              <p className="text-white/60 text-sm">List your services and get booked</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-bold">€0</span>
                <span className="text-white/60 mb-1.5 text-sm">to join</span>
              </div>
              <p className="text-white/50 text-xs mt-1">You keep 100% of your quoted rate, always</p>
            </div>
            <div className="px-6 py-6 space-y-3">
              {PROVIDER_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <CheckCircle2 size={15} className="text-[#2D7A5F] shrink-0" />
                  <span className="text-sm text-[#2B3441]">{f}</span>
                </div>
              ))}
              <div className="pt-4">
                <div className="bg-[#EDF5F0] rounded-xl px-4 py-4 text-sm space-y-2">
                  <p className="font-semibold text-[#2B3441] text-xs uppercase tracking-wide">Example booking</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Your quoted rate</span>
                    <span className="font-medium text-[#2B3441]">€80</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">DORIXÉ fee on you</span>
                    <span className="font-medium text-[#2D7A5F] font-bold">€0</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-[#2D7A5F]/20 pt-2">
                    <span className="text-[#2B3441]">You receive</span>
                    <span className="text-[#2D7A5F]">€80</span>
                  </div>
                </div>
              </div>
              <Link
                href="/become-a-cleaner"
                className="block w-full text-center mt-4 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
              >
                Become a cleaner →
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-6 text-center">How we compare</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6B7280]">Feature</th>
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#2D7A5F]">DORIXÉ</th>
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6B7280]">Typical competitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {COMPARISON.map(({ feature, dorixe, competitor }) => (
                <tr key={feature} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-sm text-[#2B3441]">{feature}</td>
                  <td className="px-5 py-3.5 text-center">
                    {dorixe
                      ? <CheckCircle2 size={16} className="text-[#2D7A5F] mx-auto" />
                      : <XCircle size={16} className="text-gray-300 mx-auto" />}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {competitor
                      ? <CheckCircle2 size={16} className="text-gray-400 mx-auto" />
                      : <XCircle size={16} className="text-gray-300 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ strip */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-16 space-y-6">
          <h2 className="font-serif text-2xl font-bold text-[#2B3441]">Common questions</h2>
          {[
            { q: "When am I charged?", a: "Your card is pre-authorised at booking. The charge is only captured when the cleaner marks the job complete — you never pay for a booking that didn't happen." },
            { q: "What if I cancel?", a: "Cancel more than 48 hours before → full refund. 24–48 hours → 50% refund. Under 24 hours → no refund. If the cleaner cancels, you always get a full refund." },
            { q: "How do cleaners get paid?", a: "Every Monday, Stripe automatically transfers the week's completed booking earnings to each cleaner's connected bank account." },
            { q: "Is there a minimum booking value?", a: "No. Cleaners set their own prices and the platform fee scales with the booking — there is no floor." },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <p className="font-semibold text-[#2B3441] mb-1.5">{q}</p>
              <p className="text-sm text-[#6B7280] leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Zap size={32} className="text-[#2D7A5F] mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-3">Ready to get started?</h2>
        <p className="text-[#6B7280] mb-8">Book your first eco-friendly cleaning or join as a cleaner — no commitment required.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/book" className="inline-flex items-center justify-center gap-2 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-8 py-3 text-sm font-semibold transition-colors">
            Book a cleaning <ArrowRight size={15} />
          </Link>
          <Link href="/become-a-cleaner" className="inline-flex items-center justify-center gap-2 border border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#EDF5F0] rounded-xl px-8 py-3 text-sm font-semibold transition-colors">
            Become a cleaner <ArrowRight size={15} />
          </Link>
        </div>
      </section>

    </div>
  )
}
