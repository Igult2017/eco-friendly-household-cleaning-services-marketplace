import type { Metadata } from "next"
import Link from "next/link"
import { Leaf, ShieldCheck, Star, Euro, Heart, Globe2, Users, Zap } from "lucide-react"

export const metadata: Metadata = {
  title: "About Us — DORIX",
  description:
    "DORIX connects eco-conscious households with vetted, eco-certified cleaners across Europe. Clean home. Green future.",
}

const VALUES = [
  {
    icon: Leaf,
    title: "Eco-first, always",
    body: "Every provider on DORIX is vetted for their use of non-toxic, biodegradable, and certified eco-friendly products. No greenwashing — we verify the certifications.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted & verified",
    body: "All cleaners pass identity verification (Stripe Identity), background checks, and a manual approval review before their first booking. Your home, protected.",
  },
  {
    icon: Euro,
    title: "Transparent pricing",
    body: "Providers set their own prices. You pay their quoted price plus a 15% platform fee — visible before you confirm. No hidden charges, no surprises at checkout.",
  },
  {
    icon: Star,
    title: "Community-driven quality",
    body: "Every completed booking unlocks a verified review. Ratings are real — only customers who booked and paid can leave feedback. Consistent quality or providers are removed.",
  },
  {
    icon: Heart,
    title: "Fair for providers",
    body: "Cleaners keep 100% of their quoted price. The platform fee is charged to the customer, not deducted from the provider. We believe the people doing the work deserve to be paid fairly.",
  },
  {
    icon: Globe2,
    title: "Built for Europe",
    body: "DORIX is designed for the EU market — GDPR-compliant from day one, payments in EUR, European address formats, and provider onboarding that meets local regulations.",
  },
]

const STATS = [
  { value: "100%", label: "Eco-certified providers" },
  { value: "15%", label: "Platform fee (paid by customer)" },
  { value: "72h", label: "Dispute resolution target" },
  { value: "€0", label: "Deducted from provider earnings" },
]

const TIMELINE = [
  {
    year: "The problem",
    title: "Finding a trustworthy eco-cleaner was nearly impossible",
    body: "Most cleaning platforms are packed with unlisted providers using chemical-heavy products. Customers who care about sustainability had no way to verify who was actually eco-friendly and who was just claiming to be.",
  },
  {
    year: "The idea",
    title: "A marketplace that starts from eco, not retrofits it",
    body: "We decided to build a platform where eco certification is the entry requirement, not an optional badge. Every provider must prove their credentials before they can take a single booking.",
  },
  {
    year: "The solution",
    title: "DORIX — Clean home. Green future.",
    body: "A full marketplace with identity-verified providers, escrow payments, a transparent bidding system, and automated weekly payouts. Built for households who want both quality and sustainability.",
  },
]

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative bg-[#2B3441] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_50%,#2D7A5F_0%,transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2D7A5F]/20 border border-[#2D7A5F]/30 px-4 py-1.5 text-sm text-[#4CB87A] font-medium mb-6">
            <Leaf size={14} />
            Clean home. Green future.
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold mb-6 leading-tight">
            We&apos;re building the greenest<br className="hidden md:block" /> cleaning marketplace in Europe
          </h1>
          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            DORIX connects eco-conscious households with vetted, certified cleaners who care as much about the planet
            as they do about a spotless home.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[#2D7A5F]">
        <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-serif text-3xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-white/70 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our story — timeline */}
      <section className="max-w-3xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-3">Our story</span>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441]">Why we built DORIX</h2>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-[#E5EBF0] hidden md:block" />

          <div className="space-y-10">
            {TIMELINE.map((item, i) => (
              <div key={i} className="md:pl-16 relative">
                <div className="hidden md:flex absolute left-0 w-12 h-12 rounded-full bg-[#F4FAF6] border-2 border-[#2D7A5F] items-center justify-center text-xs font-bold text-[#2D7A5F] text-center leading-tight">
                  {i + 1}
                </div>
                <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-6">
                  <p className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-1">{item.year}</p>
                  <h3 className="font-serif text-xl font-bold text-[#2B3441] mb-2">{item.title}</h3>
                  <p className="text-[#6B7280] leading-relaxed text-sm">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-[#F4FAF6] border-y border-[#E5EBF0] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-4">Our mission</span>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441] mb-6">
            Make eco-friendly cleaning the default, not the exception
          </h2>
          <p className="text-[#6B7280] text-lg leading-relaxed">
            Millions of homes are cleaned every week using products that are harsh on surfaces, harmful to health, and
            damaging to waterways. We&apos;re changing that — one verified booking at a time. DORIX makes it as easy to
            book a certified eco-cleaner as it is to order a taxi.
          </p>
        </div>
      </section>

      {/* Values grid */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-3">What we stand for</span>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441]">Our values</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#D1F0E0] flex items-center justify-center mb-4">
                <v.icon size={20} className="text-[#2D7A5F]" />
              </div>
              <h3 className="font-semibold text-[#2B3441] mb-2">{v.title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How the platform works — brief */}
      <section className="bg-[#2B3441] text-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold mb-3">How DORIX works</h2>
            <p className="text-white/60 text-lg">Two ways to use the platform — for households and for cleaners.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Customer side */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
              <div className="w-10 h-10 rounded-xl bg-[#2D7A5F] flex items-center justify-center mb-4">
                <Users size={20} className="text-white" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-4">For households</h3>
              <ul className="space-y-3 text-sm text-white/70">
                {[
                  "Search vetted eco-certified cleaners near you",
                  "Book directly or post a job and receive competitive bids",
                  "Pay securely — funds held in escrow until the job is done",
                  "Leave a verified review after every booking",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#4CB87A] mt-0.5 flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/browse"
                className="inline-flex mt-6 rounded-xl bg-[#2D7A5F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
              >
                Find a cleaner →
              </Link>
            </div>

            {/* Provider side */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
              <div className="w-10 h-10 rounded-xl bg-[#4CB87A]/30 flex items-center justify-center mb-4">
                <Zap size={20} className="text-[#4CB87A]" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-4">For cleaners</h3>
              <ul className="space-y-3 text-sm text-white/70">
                {[
                  "Apply once — approval takes 1–2 business days",
                  "Set your own prices and working hours",
                  "Browse job posts and submit bids to grow your client base",
                  "Keep 100% of your quoted price — weekly bank payouts",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#4CB87A] mt-0.5 flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className="inline-flex mt-6 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Become a provider →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 text-center bg-[#F4FAF6]">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#D1F0E0] flex items-center justify-center mx-auto mb-6">
            <Leaf size={32} className="text-[#2D7A5F]" />
          </div>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441] mb-4">
            Ready for a cleaner, greener home?
          </h2>
          <p className="text-[#6B7280] text-lg mb-8">
            Join thousands of households across Europe who&apos;ve switched to eco-certified cleaning.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/browse"
              className="inline-flex justify-center rounded-xl bg-[#2D7A5F] px-8 py-4 text-white font-semibold hover:bg-[#256349] transition-colors"
            >
              Find a cleaner
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex justify-center rounded-xl border-2 border-[#2B3441] px-8 py-4 text-[#2B3441] font-semibold hover:bg-[#2B3441] hover:text-white transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
