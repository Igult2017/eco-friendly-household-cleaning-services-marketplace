import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { localeAlternates } from "@/lib/seo/alternates"
import { CheckCircle2, XCircle, ArrowRight, Euro, ShieldCheck, Leaf, Zap } from "lucide-react"
import { JsonLd } from "@/components/seo/JsonLd"
import { faqSchema } from "@/lib/seo/schemas"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "pricing" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/pricing", locale),
  }
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "pricing" })

  const CUSTOMER_FEATURES = [
    t("customerFeature1"),
    t("customerFeature2"),
    t("customerFeature3"),
    t("customerFeature4"),
    t("customerFeature5"),
    t("customerFeature6"),
    t("customerFeature7"),
    t("customerFeature8"),
  ]

  const PROVIDER_FEATURES = [
    t("providerFeature1"),
    t("providerFeature2"),
    t("providerFeature3"),
    t("providerFeature4"),
    t("providerFeature5"),
    t("providerFeature6"),
    t("providerFeature7"),
  ]

  const COMPARISON = [
    { feature: t("compareKeepRate"),        dorixe: true,  competitor: false },
    { feature: t("compareNoSubscription"),  dorixe: true,  competitor: false },
    { feature: t("compareEcoNetwork"),      dorixe: true,  competitor: false },
    { feature: t("compareMarketplace"),     dorixe: true,  competitor: false },
    { feature: t("comparePreAuth"),         dorixe: true,  competitor: false },
    { feature: t("compareDispute"),         dorixe: true,  competitor: true  },
    { feature: t("compareInstantPayout"),   dorixe: false, competitor: true  },
  ]

  const FAQS = [
    { q: t("faqChargedQ"), a: t("faqChargedA") },
    { q: t("faqContractQ"), a: t("faqContractA") },
    { q: t("faqTasksQ"), a: t("faqTasksA") },
    { q: t("faqCancelQ"), a: t("faqCancelA") },
    { q: t("faqPayoutQ"), a: t("faqPayoutA") },
    { q: t("faqMinimumQ"), a: t("faqMinimumA") },
  ]

  return (
    <div className="bg-[#F4FAF6] min-h-screen">
      <JsonLd data={faqSchema(FAQS)} />

      {/* Hero */}
      <section className="bg-[#2B3441] text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2D7A5F]/30 border border-[#2D7A5F]/40 px-4 py-1 text-xs font-semibold text-[#4CB87A] uppercase tracking-wide">
            <Euro size={11} /> {t("heroBadge")}
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
            <span className="text-white">{t("heroTitleLine1")}<br />{t("heroTitleLine2")}</span>
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            {t("heroSubtitle")}
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
              <h2 className="font-serif text-2xl font-bold mb-1">{t("customerCardTitle")}</h2>
              <p className="text-white/60 text-sm">{t("customerCardSubtitle")}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-bold">€0</span>
                <span className="text-white/60 mb-1.5 text-sm">{t("customerPriceLabel")}</span>
              </div>
              <p className="text-white/50 text-xs mt-1">{t("customerPriceNote")}</p>
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
                  <p className="font-semibold text-[#2B3441] text-xs uppercase tracking-wide">{t("exampleBooking")}</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{t("customerExampleRate")}</span>
                    <span className="font-medium text-[#2B3441]">€80</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{t("customerExampleFee")}</span>
                    <span className="font-medium text-[#2D7A5F]">€0</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                    <span className="text-[#2B3441]">{t("customerExampleTotal")}</span>
                    <span className="text-[#2D7A5F]">€80</span>
                  </div>
                </div>
              </div>
              <Link
                href="/book"
                className="block w-full text-center mt-4 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
              >
                {t("bookCleanerCta")}
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
                <span className="text-xs font-bold bg-white/20 rounded-full px-3 py-1">{t("mostPopular")}</span>
              </div>
              <h2 className="font-serif text-2xl font-bold mb-1">{t("providerCardTitle")}</h2>
              <p className="text-white/60 text-sm">{t("providerCardSubtitle")}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-bold">€0</span>
                <span className="text-white/60 mb-1.5 text-sm">{t("providerPriceLabel")}</span>
              </div>
              <p className="text-white/50 text-xs mt-1">{t("providerPriceNote")}</p>
            </div>
            <div className="px-6 py-6 space-y-3">
              {PROVIDER_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <CheckCircle2 size={15} className="text-[#2D7A5F] shrink-0" />
                  <span className="text-sm text-[#2B3441]">{f}</span>
                </div>
              ))}
              <div className="pt-4">
                <div className="bg-[#EDF5F0] rounded-xl px-4 py-4 text-sm">
                  <p className="font-semibold text-[#2B3441] text-xs uppercase tracking-wide mb-2">{t("providerHowFeeTitle")}</p>
                  <p className="text-[#6B7280] leading-relaxed">{t("providerExampleNote")}</p>
                </div>
              </div>
              <Link
                href="/become-a-cleaner"
                className="block w-full text-center mt-4 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
              >
                {t("becomeCleanerCta")}
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-6 text-center">{t("comparisonHeading")}</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6B7280]">{t("comparisonColFeature")}</th>
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#2D7A5F]">DORIXÉ</th>
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6B7280]">{t("comparisonColCompetitor")}</th>
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
          <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("faqHeading")}</h2>
          {FAQS.map(({ q, a }) => (
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
        <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-3">{t("ctaHeading")}</h2>
        <p className="text-[#6B7280] mb-8">{t("ctaSubtitle")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/book" className="inline-flex items-center justify-center gap-2 bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-8 py-3 text-sm font-semibold transition-colors">
            {t("ctaBookButton")} <ArrowRight size={15} />
          </Link>
          <Link href="/become-a-cleaner" className="inline-flex items-center justify-center gap-2 border border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#EDF5F0] rounded-xl px-8 py-3 text-sm font-semibold transition-colors">
            {t("ctaCleanerButton")} <ArrowRight size={15} />
          </Link>
        </div>
      </section>

    </div>
  )
}
