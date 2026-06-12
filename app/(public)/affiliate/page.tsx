import type { Metadata } from "next"
import Link from "next/link"
import {
  Leaf,
  Euro,
  TrendingUp,
  Users,
  Gift,
  ArrowRight,
  CheckCircle2,
  Link2,
  BarChart3,
  Infinity,
  Star,
  Zap,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Affiliate Programme — DORIXÉ",
  description:
    "Partner with DORIXÉ and earn 5% lifetime commission on every booking made by customers you refer. The eco-friendly way to grow your income.",
}

const STATS = [
  { value: "5%", label: "Lifetime commission", icon: Euro },
  { value: "€0", label: "Cost to join", icon: Gift },
  { value: "∞", label: "Earning potential", icon: Infinity },
  { value: "30d", label: "Cookie window", icon: TrendingUp },
]

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Sign up for free",
    body: "Create a DORIXÉ account (or log in to your existing one). Your unique affiliate link is generated instantly — no approval, no waiting.",
    icon: Users,
  },
  {
    step: "02",
    title: "Share your link",
    body: "Post it on Instagram, YouTube, TikTok, your blog, or newsletter. Wherever your audience hangs out, your link works.",
    icon: Link2,
  },
  {
    step: "03",
    title: "Earn on every booking",
    body: "When someone clicks your link and books a cleaning, you earn 5% of the booking value — credited to your DORIXÉ account automatically.",
    icon: BarChart3,
  },
  {
    step: "04",
    title: "Cash out or book with it",
    body: "Use your credit balance to pay for your own cleanings or withdraw it. Your credit, your choice.",
    icon: Euro,
  },
]

const BENEFITS = [
  { title: "Lifetime commission", body: "Every booking your referral makes — not just the first one — earns you 5%." },
  { title: "Real-time dashboard", body: "Track clicks, referrals, and earnings in your personal dashboard, updated live." },
  { title: "30-day cookie", body: "If someone clicks your link and books within 30 days, you get the credit." },
  { title: "No cap on earnings", body: "Refer 5 people or 5,000. There's no monthly ceiling on what you can earn." },
  { title: "Instant credit", body: "Commission lands in your credit wallet the moment a booking completes. No monthly payout delays." },
  { title: "Eco-aligned brand", body: "Promote something you're proud of — a platform that's genuinely good for the planet." },
]

const TESTIMONIALS = [
  {
    quote: "I mentioned DORIXÉ once in my home-organisation video and earned €140 in the first week. The dashboard is so clean to track.",
    name: "Anika V.",
    handle: "@anika.organises",
    followers: "82k YouTube",
  },
  {
    quote: "My eco-lifestyle newsletter recommended DORIXÉ last month. My readers loved it and I've already covered two months of my own cleanings.",
    name: "Leila M.",
    handle: "@thegreenleila",
    followers: "41k Substack",
  },
  {
    quote: "Perfect for sustainability creators. The 5% lifetime model is genuinely rare — most programmes pay only on the first order.",
    name: "Jonas B.",
    handle: "@sustainjon",
    followers: "210k TikTok",
  },
]

const IDEAL_FOR = [
  "Eco-lifestyle bloggers & vloggers",
  "Interior design & home organisation creators",
  "Sustainability influencers",
  "Parenting & family content creators",
  "Newsletter writers & podcasters",
  "Property managers & real-estate agents",
  "Mummy bloggers & family YouTubers",
  "Anyone with an engaged, home-focused audience",
]

export default async function AffiliatePage() {
  // Check auth server-side so we never redirect a signed-in user to /sign-up
  const { auth } = await import("@clerk/nextjs/server")
  const { userId } = await auth()

  // Auto-fetch (and auto-create) the referral link for signed-in users
  let referralUrl: string | null = null
  if (userId) {
    try {
      const { db } = await import("@/lib/db")
      const { referralCodes } = await import("@/lib/db/schema")
      const { eq } = await import("drizzle-orm")
      const { customAlphabet } = await import("nanoid")

      const genCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8)
      let [row] = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1)
      if (!row) {
        const code = genCode()
        const inserted = await db.insert(referralCodes).values({ userId, code }).onConflictDoNothing().returning()
        row = inserted[0] ?? (await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1))[0]
      }
      if (row) referralUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/?ref=${row.code}`
    } catch (err) {
      console.error("[affiliate] referral code error", err)
    }
  }

  const heroPrimary   = userId ? { href: "/dashboard", label: "Go to my affiliate dashboard" } : { href: "/sign-up", label: "Get your link free" }
  const heroSecondary = userId ? null : { href: "/sign-in", label: "Already a member? Sign in" }
  const ctaPrimary    = userId ? { href: "/dashboard", label: "View my affiliate link" }        : { href: "/sign-up", label: "Get your affiliate link" }

  return (
    <div className="bg-[#F4FAF6] min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#2B3441] text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, #2D7A5F 0%, transparent 50%), radial-gradient(circle at 80% 20%, #4CB87A 0%, transparent 40%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <span className="mb-6 inline-flex items-center rounded-full border border-[#2D7A5F]/30 bg-[#2D7A5F]/20 px-3 py-1 text-xs font-semibold text-[#4CB87A]">
              <Leaf className="w-3 h-3 mr-1" />
              Affiliate Programme
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold leading-tight mb-6 text-white">
              <span className="block">Earn while you</span>
              <span className="block bg-gradient-to-r from-[#4CB87A] to-[#2D7A5F] bg-clip-text text-transparent">
                promote the green way
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-white/70 leading-relaxed mb-10 max-w-2xl">
              Partner with DORIXÉ and earn <strong className="text-white">5% lifetime commission</strong> on every
              booking made by customers you refer. No cap. No expiry. Just recurring credit for work you did once.
            </p>

            {/* Signed-in: show their link inline */}
            {userId && referralUrl && (
              <div className="mb-8 flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-3 max-w-lg">
                <span className="flex-1 font-mono text-sm text-white/80 truncate">{referralUrl}</span>
                <span className="text-xs font-semibold text-[#4CB87A] bg-[#2D7A5F]/30 rounded-lg px-3 py-1.5 shrink-0">Your link</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={heroPrimary.href}
                className="inline-flex items-center justify-center gap-2 bg-[#2D7A5F] hover:bg-[#245f4a] text-white rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
              >
                {heroPrimary.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
              {heroSecondary && (
                <Link
                  href={heroSecondary.href}
                  className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-200"
                >
                  {heroSecondary.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F4FAF6] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#2D7A5F]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#2B3441] font-serif">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#2B3441] mb-4">How it works</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            From sign-up to first commission in under 5 minutes.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map(({ step, title, body, icon: Icon }) => (
            <div
              key={step}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl font-serif font-bold text-[#E8F4EE] leading-none select-none">{step}</span>
                <div className="w-10 h-10 rounded-lg bg-[#F4FAF6] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#2D7A5F]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[#2B3441] mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits grid */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="mb-4 inline-flex items-center rounded-full border border-[#2D7A5F]/20 bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#2D7A5F]">Why DORIXÉ?</span>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#2B3441] mb-6">
                A programme built to reward loyal partners
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                We designed our affiliate programme the way we'd want one ourselves — lifetime commissions, instant
                crediting, and a dashboard that actually shows you what's happening. No black boxes.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-[#2D7A5F] hover:bg-[#245f4a] text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Join now — it's free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BENEFITS.map(({ title, body }) => (
                <div key={title} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#2D7A5F] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#2B3441] mb-0.5">{title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ideal for */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#2B3441] mb-4">Perfect for creators like you</h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            If your audience cares about their home, sustainability, or quality of life — DORIXÉ is the ideal fit.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {IDEAL_FOR.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm text-[#2B3441] font-medium"
            >
              <Leaf className="w-3.5 h-3.5 text-[#2D7A5F] flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[#2B3441] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4">Creators already earning</h2>
            <p className="text-white/60">Real partners. Real commissions.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, handle, followers }) => (
              <div
                key={name}
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/8 transition-colors duration-200"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#4CB87A] text-[#4CB87A]" />
                  ))}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-6">"{quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#2D7A5F]/40 flex items-center justify-center text-sm font-bold text-[#4CB87A]">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="text-xs text-white/40">
                      {handle} · {followers}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission explainer */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F4FAF6] flex items-center justify-center mx-auto mb-6">
            <Zap className="w-7 h-7 text-[#2D7A5F]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#2B3441] mb-4">
            How commissions are calculated
          </h2>
          <p className="text-gray-500 leading-relaxed mb-10 max-w-2xl mx-auto">
            You earn <strong>5% of each booking's subtotal</strong> (the provider's price, before the platform fee).
            There's no cap per booking, no cap per month, and no expiry. If someone you referred books twice a week
            for years, you earn on every single one of those bookings.
          </p>
          <div className="bg-[#F4FAF6] rounded-2xl p-8 text-left max-w-lg mx-auto">
            <p className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-wider mb-4">Example calculation</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Booking subtotal</span>
                <span className="font-medium text-[#2B3441]">€120</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Your commission (5%)</span>
                <span className="font-medium text-[#2D7A5F]">€6.00</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="text-gray-500">Bookings / month (estimate)</span>
                <span className="font-medium text-[#2B3441]">× 4</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#2B3441]">Monthly earnings per referral</span>
                <span className="font-bold text-[#2D7A5F]">€24 / mo</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#2D7A5F] to-[#1a5a43] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <Leaf className="w-10 h-10 text-white/40 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4">
            {userId ? "Your affiliate link is ready." : "Start earning today. No approval needed."}
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto">
            {userId
              ? "Share your unique link and earn 5% on every booking your referrals make — forever."
              : "Sign up, grab your link, and share. Your first commission could arrive before the week is out."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={ctaPrimary.href}
              className="inline-flex items-center justify-center gap-2 bg-white text-[#2D7A5F] hover:bg-white/90 rounded-xl px-10 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
            >
              {ctaPrimary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!userId && (
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center border border-white/30 text-white hover:bg-white/10 rounded-xl px-10 py-3 text-sm font-semibold transition-all duration-200"
              >
                Sign in to existing account
              </Link>
            )}
          </div>
          {!userId && (
            <p className="mt-8 text-white/40 text-xs">
              By joining, you agree to our{" "}
              <Link href="/legal/terms" className="underline hover:text-white/70 transition-colors">
                Terms of Service
              </Link>
              . Commission paid as platform credit.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
