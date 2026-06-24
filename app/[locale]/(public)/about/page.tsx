import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { localeAlternates } from "@/lib/seo/alternates"
import { Leaf, ShieldCheck, Star, Euro, Heart, Globe2, Users, Zap } from "lucide-react"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await params
  return {
    title: "About Us — DORIXÉ",
    description:
      "DORIXÉ connects eco-conscious households with vetted, eco-certified cleaners across Europe. Clean home. Green future.",
    alternates: localeAlternates("/about"),
  }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "about" })

  const VALUES = [
    {
      icon: Leaf,
      title: t("valueEcoFirstTitle"),
      body: t("valueEcoFirstBody"),
    },
    {
      icon: ShieldCheck,
      title: t("valueTrustedTitle"),
      body: t("valueTrustedBody"),
    },
    {
      icon: Euro,
      title: t("valuePricingTitle"),
      body: t("valuePricingBody"),
    },
    {
      icon: Star,
      title: t("valueQualityTitle"),
      body: t("valueQualityBody"),
    },
    {
      icon: Heart,
      title: t("valueFairTitle"),
      body: t("valueFairBody"),
    },
    {
      icon: Globe2,
      title: t("valueEuropeTitle"),
      body: t("valueEuropeBody"),
    },
  ]

  const STATS = [
    { value: "100%", label: t("statEcoCertified") },
    { value: "€0", label: t("statPlatformFee") },
    { value: "72h", label: t("statDisputeTarget") },
    { value: "€0", label: t("statDeducted") },
  ]

  const TIMELINE = [
    {
      year: t("timelineProblemYear"),
      title: t("timelineProblemTitle"),
      body: t("timelineProblemBody"),
    },
    {
      year: t("timelineIdeaYear"),
      title: t("timelineIdeaTitle"),
      body: t("timelineIdeaBody"),
    },
    {
      year: t("timelineSolutionYear"),
      title: t("timelineSolutionTitle"),
      body: t("timelineSolutionBody"),
    },
  ]

  const CUSTOMER_POINTS = [
    t("customerPoint1"),
    t("customerPoint2"),
    t("customerPoint3"),
    t("customerPoint4"),
  ]

  const PROVIDER_POINTS = [
    t("providerPoint1"),
    t("providerPoint2"),
    t("providerPoint3"),
    t("providerPoint4"),
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-[#2B3441] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_50%,#2D7A5F_0%,transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2D7A5F]/20 border border-[#2D7A5F]/30 px-4 py-1.5 text-sm text-[#4CB87A] font-medium mb-6">
            <Leaf size={14} />
            {t("tagline")}
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-white">{t("heroTitleLine1")}<br className="hidden md:block" /> {t("heroTitleLine2")}</span>
          </h1>
          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
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
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-3">{t("storyEyebrow")}</span>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441]">{t("storyHeading")}</h2>
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
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-4">{t("missionEyebrow")}</span>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441] mb-6">
            {t("missionHeading")}
          </h2>
          <p className="text-[#6B7280] text-lg leading-relaxed">
            {t("missionBody")}
          </p>
        </div>
      </section>

      {/* Values grid */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-3">{t("valuesEyebrow")}</span>
          <h2 className="font-serif text-4xl font-bold text-[#2B3441]">{t("valuesHeading")}</h2>
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
            <h2 className="font-serif text-4xl font-bold mb-3">{t("howHeading")}</h2>
            <p className="text-white/60 text-lg">{t("howSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Customer side */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
              <div className="w-10 h-10 rounded-xl bg-[#2D7A5F] flex items-center justify-center mb-4">
                <Users size={20} className="text-white" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-4">{t("forHouseholdsTitle")}</h3>
              <ul className="space-y-3 text-sm text-white/70">
                {CUSTOMER_POINTS.map((item) => (
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
                {t("findCleanerArrow")}
              </Link>
            </div>

            {/* Provider side */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
              <div className="w-10 h-10 rounded-xl bg-[#4CB87A]/30 flex items-center justify-center mb-4">
                <Zap size={20} className="text-[#4CB87A]" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-4">{t("forCleanersTitle")}</h3>
              <ul className="space-y-3 text-sm text-white/70">
                {PROVIDER_POINTS.map((item) => (
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
                {t("becomeProviderArrow")}
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
            {t("ctaHeading")}
          </h2>
          <p className="text-[#6B7280] text-lg mb-8">
            {t("ctaBody")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/browse"
              className="inline-flex justify-center rounded-xl bg-[#2D7A5F] px-8 py-4 text-white font-semibold hover:bg-[#256349] transition-colors"
            >
              {t("findCleaner")}
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex justify-center rounded-xl border-2 border-[#2B3441] px-8 py-4 text-[#2B3441] font-semibold hover:bg-[#2B3441] hover:text-white transition-colors"
            >
              {t("howItWorks")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
