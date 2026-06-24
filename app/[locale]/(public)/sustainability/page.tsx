export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { providers, carbonOffsetContributions } from "@/lib/db/schema"
import { eq, count, sum, sql } from "drizzle-orm"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sustainability")
  return {
    title: t("metaTitle"),
  }
}

async function getEcoStats() {
  try {
    const [totalProviders] = await db.select({ count: count() }).from(providers).where(eq(providers.isApproved, true))
    const [ecoProviders] = await db.select({ count: count() }).from(providers).where(sql`${providers.ecoLevel} IN ('certified','premium','zero_impact') AND ${providers.isApproved} = true`)
    const [offsetTotal] = await db.select({ total: sum(carbonOffsetContributions.amount) }).from(carbonOffsetContributions)

    return {
      totalProviders: Number(totalProviders?.count ?? 0),
      ecoProviders: Number(ecoProviders?.count ?? 0),
      offsetEuros: Number(offsetTotal?.total ?? 0) / 100,
    }
  } catch {
    return { totalProviders: 0, ecoProviders: 0, offsetEuros: 0 }
  }
}

export default async function SustainabilityPage() {
  const t = await getTranslations("sustainability")
  const stats = await getEcoStats()
  const ecoPercent = stats.totalProviders > 0 ? Math.round((stats.ecoProviders / stats.totalProviders) * 100) : 0

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#2D7A5F] text-white py-20 px-4 text-center">
        <p className="text-[#4CB87A] uppercase tracking-widest text-xs font-semibold mb-3">{t("heroEyebrow")}</p>
        <h1 className="font-serif text-5xl font-bold mb-4">{t("heroTitle")}</h1>
        <p className="text-white/80 max-w-xl mx-auto text-lg leading-relaxed">
          {t("heroSubtitle")}
        </p>
      </section>

      {/* Stats band */}
      <section className="bg-[#2B3441] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { value: `${ecoPercent}%`, label: t("statEcoCertified") },
            { value: `€${stats.offsetEuros.toFixed(0)}`, label: t("statCarbonOffsets") },
            { value: `${stats.ecoProviders}`, label: t("statEcoVerified") },
          ].map((s, i) => (
            <div key={i}>
              <p className="font-serif text-5xl font-bold text-[#4CB87A]">{s.value}</p>
              <p className="text-white/60 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Eco levels */}
      <section className="max-w-4xl mx-auto py-20 px-4">
        <h2 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-10">{t("badgeSystemTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { level: t("levelBasic"), color: "bg-gray-100 text-gray-600", desc: t("levelBasicDesc") },
            { level: t("levelCertified"), color: "bg-green-100 text-green-700", desc: t("levelCertifiedDesc") },
            { level: t("levelPremium"), color: "bg-emerald-100 text-emerald-700", desc: t("levelPremiumDesc") },
            { level: t("levelZeroImpact"), color: "bg-[#2D7A5F]/10 text-[#2D7A5F]", desc: t("levelZeroImpactDesc") },
          ].map((l) => (
            <div key={l.level} className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold mb-4 ${l.color}`}>{l.level}</span>
              <p className="text-sm text-[#6B7280] leading-relaxed">{l.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#F4FAF6] border-t border-gray-200 py-16 px-4 text-center">
        <h2 className="font-serif text-3xl font-bold text-[#2B3441] mb-4">{t("ctaTitle")}</h2>
        <p className="text-[#6B7280] mb-8">{t("ctaSubtitle")}</p>
        <a href="/book" className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] px-8 py-4 text-white font-semibold hover:bg-[#256349] transition-colors">
          {t("ctaButton")}
        </a>
      </section>
    </div>
  )
}
