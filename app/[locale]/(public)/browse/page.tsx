export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { providers, users, providerServices } from "@/lib/db/schema"
import { eq, desc, and, ilike, gte, inArray } from "drizzle-orm"
import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { formatCurrencyShort, priceUnitSuffix } from "@/lib/utils/formatCurrency"
import { BrowseNearMe } from "@/components/browse/BrowseNearMe"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("browse")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

const ecoLabelColors: Record<string, string> = {
  basic: "bg-gray-100 text-gray-600",
  certified: "bg-green-100 text-green-700",
  premium: "bg-emerald-100 text-emerald-700",
  zero_impact: "bg-[#2D7A5F]/10 text-[#2D7A5F]",
}

async function getProviders(filters: { city?: string; ecoLevel?: string; minRating?: string }) {
  const conditions: Parameters<typeof and>[0][] = [eq(providers.isApproved, true), eq(providers.isSuspended, false)]

  if (filters.city) conditions.push(ilike(providers.city, "%" + filters.city + "%"))
  if (filters.ecoLevel) conditions.push(eq(providers.ecoLevel, filters.ecoLevel as "basic" | "certified" | "premium" | "zero_impact"))
  if (filters.minRating) {
    const r = parseFloat(filters.minRating)
    if (!isNaN(r)) conditions.push(gte(providers.averageRating, r))
  }

  try {
    const rows = await db
      .select({
        id: providers.id,
        slug: providers.slug,
        businessName: providers.businessName,
        bio: providers.bio,
        city: providers.city,
        country: providers.country,
        ecoLevel: providers.ecoLevel,
        averageRating: providers.averageRating,
        totalReviews: providers.totalReviews,
        totalJobsCompleted: providers.totalJobsCompleted,
        profilePhotoUrl: providers.profilePhotoUrl,
        verificationStatus: providers.verificationStatus,
      })
      .from(providers)
      .where(and(...conditions))
      .orderBy(desc(providers.averageRating))
      .limit(48)

    if (rows.length === 0) return []

    // Each provider's "from" price = the cheapest of their active services.
    const ids = rows.map((r) => r.id)
    const svc = await db
      .select({
        providerId: providerServices.providerId,
        basePrice: providerServices.basePrice,
        priceUnit: providerServices.priceUnit,
      })
      .from(providerServices)
      .where(and(eq(providerServices.isActive, true), inArray(providerServices.providerId, ids)))

    // Prefer the cheapest per-hour rate (what we show as "€X/hr"); fall back to the
    // cheapest service of any unit so providers who price per job still show a price.
    const hourly = new Map<string, number>()
    const cheapest = new Map<string, { price: number; unit: string }>()
    for (const s of svc) {
      if (s.priceUnit === "per_hour") {
        const h = hourly.get(s.providerId)
        if (h == null || s.basePrice < h) hourly.set(s.providerId, s.basePrice)
      }
      const cur = cheapest.get(s.providerId)
      if (!cur || s.basePrice < cur.price) cheapest.set(s.providerId, { price: s.basePrice, unit: s.priceUnit })
    }

    // priceFrom is still computed for DISPLAY on each card (cheapest hourly rate, else cheapest service).
    const result = rows.map((r) => {
      const chosen = hourly.has(r.id)
        ? { price: hourly.get(r.id)!, unit: "per_hour" }
        : cheapest.get(r.id) ?? null
      return { ...r, priceFrom: chosen?.price ?? null, priceUnit: chosen?.unit ?? null }
    })
    return result
  } catch {
    return []
  }
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ city?: string; ecoLevel?: string; minRating?: string }> }) {
  const { city, ecoLevel, minRating } = await searchParams
  const providerList = await getProviders({ city, ecoLevel, minRating })
  const t = await getTranslations("browse")
  const hasFilters = !!(city || ecoLevel || minRating)

  const ecoLabelText: Record<string, string> = {
    basic: t("ecoBasic"),
    certified: t("ecoCertified"),
    premium: t("ecoPremium"),
    zero_impact: t("ecoZeroImpact"),
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <form method="GET" action="/browse" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#6B7280]">{t("cityLabel")}</label>
          <input name="city" defaultValue={city ?? ""} placeholder={t("cityPlaceholder")} className="rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#6B7280]">{t("ecoLevelLabel")}</label>
          <select name="ecoLevel" defaultValue={ecoLevel ?? ""} className="rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm">
            <option value="">{t("anyOption")}</option>
            <option value="basic">{t("ecoBasic")}</option>
            <option value="certified">{t("ecoCertified")}</option>
            <option value="premium">{t("ecoPremium")}</option>
            <option value="zero_impact">{t("ecoZeroImpact")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#6B7280]">{t("minRatingLabel")}</label>
          <select name="minRating" defaultValue={minRating ?? ""} className="rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm">
            <option value="">{t("anyOption")}</option>
            <option value="3">{t("rating3")}</option>
            <option value="4">{t("rating4")}</option>
            <option value="4.5">{t("rating45")}</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white">{t("filterButton")}</button>
        {hasFilters && (
          <a href="/browse" className="rounded-lg border border-[#E5EBF0] px-4 py-2 text-sm text-[#6B7280]">{t("clearButton")}</a>
        )}
      </form>
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-[#6B7280]">{hasFilters ? t("resultsFiltered", { count: providerList.length }) : t("resultsAvailable", { count: providerList.length })}</p>
          <BrowseNearMe activeCity={city ?? null} labels={{ detecting: t("nearDetecting"), nearYou: t("nearYouChip") }} />
        </div>
      </div>

      {providerList.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl bg-white border border-[#E5EBF0] shadow-sm px-6 py-14 text-center">
          <p className="font-serif text-xl font-bold text-[#2B3441] mb-2">{t("emptyNearTitle")}</p>
          <p className="text-sm text-[#6B7280] mb-6">{t("emptyNearBody")}</p>
          <Link
            href="/post-job"
            className="inline-flex items-center justify-center rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold px-6 py-3 transition-colors"
          >
            {t("postJobCta")}
          </Link>
          {hasFilters && (
            <p className="mt-4">
              <Link href="/browse" className="text-sm text-[#6B7280] underline hover:text-[#2B3441]">{t("showAllCleaners")}</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {providerList.map((p) => {
            const ecoColor = ecoLabelColors[p.ecoLevel] ?? ecoLabelColors.basic
            const ecoLabel = ecoLabelText[p.ecoLevel] ?? ecoLabelText.basic
            return (
              <div key={p.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    {p.profilePhotoUrl ? (
                      <img src={p.profilePhotoUrl} alt={p.businessName} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-[#2D7A5F]/10 flex items-center justify-center text-[#2D7A5F] font-bold text-lg">
                        {p.businessName[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#2B3441] truncate">{p.businessName}</p>
                      <p className="text-xs text-[#6B7280]">{p.city}, {p.country}</p>
                    </div>
                  </div>

                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold mb-3 ${ecoColor}`}>
                    🌿 {ecoLabel}
                  </span>
                  {p.verificationStatus === "verified" && (
                    <span className="ml-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{t("verifiedBadge")}</span>
                  )}

                  {p.bio && (
                    <p className="text-sm text-[#6B7280] line-clamp-2 leading-relaxed mb-3">{p.bio}</p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#2B3441]">★ {(p.averageRating ?? 0).toFixed(1)}</span>
                      <span>({p.totalReviews})</span>
                      <span>·</span>
                      <span>{t("jobsCount", { count: p.totalJobsCompleted })}</span>
                    </div>
                    {p.priceFrom != null ? (
                      <span className="whitespace-nowrap text-sm font-bold text-[#2D7A5F]">
                        {p.priceUnit !== "per_hour" && `${t("priceFrom")} `}
                        {formatCurrencyShort(p.priceFrom)}
                        <span className="text-[11px] font-medium text-[#6B7280]">
                          {priceUnitSuffix[p.priceUnit ?? "per_job"] ?? ""}
                        </span>
                      </span>
                    ) : (
                      <span className="whitespace-nowrap text-xs italic text-[#9CA3AF]">{t("priceOnRequest")}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/providers/${p.slug}`}
                      className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-sm font-medium text-[#6B7280] hover:border-[#2D7A5F] hover:text-[#2D7A5F] transition-colors"
                    >
                      {t("viewButton")}
                    </Link>
                    <Link
                      href={`/book?providerId=${p.id}`}
                      className="flex-1 rounded-lg bg-[#2D7A5F] py-2 text-center text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
                    >
                      {t("bookButton")}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
