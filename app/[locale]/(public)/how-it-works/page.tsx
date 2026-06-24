import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "howItWorksPage" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "howItWorksPage" })

  const STEPS_CUSTOMER = [
    {
      num: "01",
      title: t("customerStep1Title"),
      desc: t("customerStep1Desc"),
    },
    {
      num: "02",
      title: t("customerStep2Title"),
      desc: t("customerStep2Desc"),
    },
    {
      num: "03",
      title: t("customerStep3Title"),
      desc: t("customerStep3Desc"),
    },
  ]

  const STEPS_PROVIDER = [
    {
      num: "01",
      title: t("providerStep1Title"),
      desc: t("providerStep1Desc"),
    },
    {
      num: "02",
      title: t("providerStep2Title"),
      desc: t("providerStep2Desc"),
    },
    {
      num: "03",
      title: t("providerStep3Title"),
      desc: t("providerStep3Desc"),
    },
  ]

  const TRUST_BADGES = [
    { icon: "🔒", label: t("badgeSecureLabel"), sub: t("badgeSecureSub") },
    { icon: "🌿", label: t("badgeEcoLabel"), sub: t("badgeEcoSub") },
    { icon: "⭐", label: t("badgeVettedLabel"), sub: t("badgeVettedSub") },
    { icon: "💬", label: t("badgeDisputeLabel"), sub: t("badgeDisputeSub") },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#F4FAF6] py-16 px-4 text-center border-b border-gray-200">
        <h1 className="font-serif text-5xl font-bold text-[#2B3441] mb-4">{t("heroTitle")}</h1>
        <p className="text-[#6B7280] max-w-xl mx-auto text-lg">
          {t("heroSubtitle")}
        </p>
      </section>

      {/* Customer steps */}
      <section className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <span className="inline-flex rounded-full bg-[#2D7A5F]/10 px-4 py-1.5 text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest mb-3">{t("customerBadge")}</span>
          <h2 className="font-serif text-3xl font-bold text-[#2B3441]">{t("customerHeading")}</h2>
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
            {t("customerCta")}
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="bg-[#2B3441] h-px mx-auto max-w-4xl" />

      {/* Provider steps */}
      <section className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <span className="inline-flex rounded-full bg-[#2B3441]/10 px-4 py-1.5 text-xs font-semibold text-[#2B3441] uppercase tracking-widest mb-3">{t("providerBadge")}</span>
          <h2 className="font-serif text-3xl font-bold text-[#2B3441]">{t("providerHeading")}</h2>
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
            {t("providerCta")}
          </Link>
        </div>
      </section>

      {/* Trust badges */}
      <section className="bg-[#F4FAF6] border-t border-gray-200 py-12 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {TRUST_BADGES.map((b) => (
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
