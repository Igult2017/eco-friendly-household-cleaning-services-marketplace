import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "How It Works — DORIX",
  description: "Book trusted eco-friendly cleaners in 3 simple steps.",
}

const STEPS_CUSTOMER = [
  {
    num: "01",
    title: "Search & choose",
    desc: "Enter your postcode or city. Browse vetted eco-certified cleaners sorted by rating and distance. Filter by service type, eco level, and availability.",
  },
  {
    num: "02",
    title: "Book & pay",
    desc: "Select a time slot, add special instructions, and pay securely via card. Your payment is held in escrow — only released after the job is done.",
  },
  {
    num: "03",
    title: "Relax",
    desc: "Your cleaner arrives at the scheduled time using non-toxic, eco-certified products. After completion, leave a review and help grow the green cleaning community.",
  },
]

const STEPS_PROVIDER = [
  {
    num: "01",
    title: "Apply & verify",
    desc: "Create a provider account, submit your eco certifications, and complete identity verification. Approval takes 1–2 business days.",
  },
  {
    num: "02",
    title: "Set up your profile",
    desc: "Add your services, pricing, working hours, and service radius. Connect your Stripe account for weekly payouts.",
  },
  {
    num: "03",
    title: "Start earning",
    desc: "Browse job posts, submit bids, or receive direct bookings. Get paid weekly via bank transfer. DORIX charges customers a 15% platform fee — you keep 100% of your quoted price.",
  },
]

export default function HowItWorksPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[#F4FAF6] py-16 px-4 text-center border-b border-gray-200">
        <h1 className="font-serif text-5xl font-bold text-[#2B3441] mb-4">How DORIX works</h1>
        <p className="text-[#6B7280] max-w-xl mx-auto text-lg">
          Book trusted, eco-certified cleaners in minutes. Or join as a provider and grow your eco-cleaning business.
        </p>
      </section>

      {/* Customer steps */}
      <section className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-3">For customers</span>
          <h2 className="font-serif text-3xl font-bold text-[#2B3441]">Book in 3 steps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS_CUSTOMER.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#2D7A5F] text-white font-serif text-xl font-bold flex items-center justify-center mx-auto mb-4">
                {s.num}
              </div>
              <h3 className="font-semibold text-lg text-[#2B3441] mb-2">{s.title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/book" className="inline-flex rounded-xl bg-[#2D7A5F] px-8 py-4 text-white font-semibold hover:bg-[#256349] transition-colors">
            Book a cleaner →
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="bg-[#2B3441] h-px mx-auto max-w-4xl" />

      {/* Provider steps */}
      <section className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <span className="inline-flex rounded-full bg-[#2B3441]/10 px-4 py-1.5 text-xs font-semibold text-[#2B3441] uppercase tracking-widest mb-3">For providers</span>
          <h2 className="font-serif text-3xl font-bold text-[#2B3441]">Start earning in 3 steps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS_PROVIDER.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#2B3441] text-white font-serif text-xl font-bold flex items-center justify-center mx-auto mb-4">
                {s.num}
              </div>
              <h3 className="font-semibold text-lg text-[#2B3441] mb-2">{s.title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/onboarding" className="inline-flex rounded-xl border-2 border-[#2B3441] px-8 py-4 text-[#2B3441] font-semibold hover:bg-[#2B3441] hover:text-white transition-colors">
            Become a provider →
          </Link>
        </div>
      </section>

      {/* Trust badges */}
      <section className="bg-[#F4FAF6] border-t border-gray-200 py-12 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: "🔒", label: "Secure payments", sub: "Stripe escrow" },
            { icon: "🌿", label: "Eco-certified", sub: "Verified products" },
            { icon: "⭐", label: "Vetted providers", sub: "ID-verified" },
            { icon: "💬", label: "Dispute support", sub: "72h resolution" },
          ].map((b) => (
            <div key={b.label}>
              <div className="text-3xl mb-2">{b.icon}</div>
              <p className="font-semibold text-sm text-[#2B3441]">{b.label}</p>
              <p className="text-xs text-[#6B7280]">{b.sub}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
