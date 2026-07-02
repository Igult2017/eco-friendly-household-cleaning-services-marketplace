export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { providers, users, providerServices, reviews } from "@/lib/db/schema"
import { eq, avg, count, desc } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { formatCurrencyShort, priceUnitSuffix } from "@/lib/utils/formatCurrency"
import { getTranslations } from "next-intl/server"
import { JsonLd } from "@/components/seo/JsonLd"
import { providerSchema, breadcrumbSchema } from "@/lib/seo/schemas"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params
    const [p] = await db.select({ businessName: providers.businessName, bio: providers.bio }).from(providers).where(eq(providers.slug, slug))
    if (!p) return {}
    return { title: `${p.businessName} — DORIXÉ`, description: p.bio ?? undefined }
  } catch {
    return {}
  }
}

export default async function ProviderProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = await getTranslations("providerProfile")

  let provider, owner, services, recentReviews
  try {
    ;[provider] = await db
      .select({
        id: providers.id,
        businessName: providers.businessName,
        bio: providers.bio,
        city: providers.city,
        country: providers.country,
        ecoLevel: providers.ecoLevel,
        ecoScore: providers.ecoScore,
        averageRating: providers.averageRating,
        totalReviews: providers.totalReviews,
        totalJobsCompleted: providers.totalJobsCompleted,
        profilePhotoUrl: providers.profilePhotoUrl,
        galleryUrls: providers.galleryUrls,
        isApproved: providers.isApproved,
        isSuspended: providers.isSuspended,
        userId: providers.userId,
        verificationStatus: providers.verificationStatus,
      })
      .from(providers)
      .where(eq(providers.slug, slug))

    // Suspended cleaners must not stay publicly bookable — every downstream step rejects them anyway.
    if (!provider || !provider.isApproved || provider.isSuspended) notFound()

    ;[owner] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, provider.userId))

    services = await db
      .select({ id: providerServices.id, name: providerServices.name, description: providerServices.description, basePrice: providerServices.basePrice, priceUnit: providerServices.priceUnit, isActive: providerServices.isActive })
      .from(providerServices)
      .where(eq(providerServices.providerId, provider.id))

    recentReviews = await db
      .select({ id: reviews.id, overallRating: reviews.overallRating, title: reviews.title, body: reviews.body, createdAt: reviews.createdAt })
      .from(reviews)
      .where(eq(reviews.providerId, provider.id))
      .orderBy(desc(reviews.createdAt))
      .limit(5)
  } catch {
    notFound()
  }

  if (!provider) notFound()
  owner = owner ?? null
  services = services ?? []
  recentReviews = recentReviews ?? []

  // "From" price = cheapest active service (matches browse + book cards).
  const activeServices = services.filter((s) => s.isActive)
  const fromPrice = activeServices.length ? Math.min(...activeServices.map((s) => s.basePrice)) : null
  const fromUnit = fromPrice != null ? activeServices.find((s) => s.basePrice === fromPrice)?.priceUnit ?? null : null

  const ecoColors: Record<string, string> = {
    basic: "bg-gray-100 text-gray-600",
    certified: "bg-green-100 text-green-700",
    premium: "bg-emerald-100 text-emerald-700",
    zero_impact: "bg-[#2D7A5F]/10 text-[#2D7A5F]",
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <JsonLd
        data={[
          providerSchema({
            slug,
            businessName: provider.businessName,
            bio: provider.bio,
            city: provider.city,
            country: provider.country,
            averageRating: provider.averageRating,
            totalReviews: provider.totalReviews,
            profilePhotoUrl: provider.profilePhotoUrl,
            services: activeServices.map((s) => ({ name: s.name, description: s.description, basePrice: s.basePrice, priceUnit: s.priceUnit })),
            reviews: recentReviews.map((r) => ({ rating: r.overallRating, title: r.title, body: r.body, createdAt: r.createdAt })),
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Find cleaners", path: "/browse" },
            { name: provider.businessName, path: `/providers/${slug}` },
          ]),
        ]}
      />
      {/* Header */}
      <div className="flex items-start gap-6">
        {provider.profilePhotoUrl ? (
          <img src={provider.profilePhotoUrl} alt={provider.businessName} className="h-24 w-24 rounded-2xl object-cover shadow" />
        ) : (
          <div className="h-24 w-24 rounded-2xl bg-[#2D7A5F]/10 flex items-center justify-center text-[#2D7A5F] font-bold text-3xl">
            {provider.businessName[0]}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{provider.businessName}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${ecoColors[provider.ecoLevel] ?? ecoColors.basic}`}>
              🌿 {provider.ecoLevel.replace("_", " ")}
            </span>
            {provider.verificationStatus === "verified" && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                ✓ {t("idVerified")}
              </span>
            )}
          </div>
          <p className="text-sm text-[#6B7280] mt-1">{provider.city}, {provider.country}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm font-semibold text-[#2B3441]">★ {(provider.averageRating ?? 0).toFixed(1)}</span>
            <span className="text-sm text-[#6B7280]">({t("reviewsCount", { count: provider.totalReviews })})</span>
            <span className="text-sm text-[#6B7280]">{t("jobsDone", { count: provider.totalJobsCompleted })}</span>
          </div>
          {fromPrice != null && (
            <p className="mt-2 text-base font-bold text-[#2D7A5F]">
              {t("fromPrice", { price: formatCurrencyShort(fromPrice) })}
              <span className="text-xs font-medium text-[#6B7280]">{priceUnitSuffix[fromUnit ?? "per_job"] ?? ""}</span>
            </p>
          )}
          {provider.bio && <p className="text-sm text-[#6B7280] mt-3 max-w-xl leading-relaxed">{provider.bio}</p>}
        </div>
        <Link
          href={`/book?providerId=${provider.id}`}
          className="shrink-0 rounded-xl bg-[#2D7A5F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
        >
          {t("bookNow")}
        </Link>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-4">{t("servicesHeading")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#2B3441]">{s.name}</p>
                    {s.description && <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">{s.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#2D7A5F]">€{((s.basePrice ?? 0) / 100).toFixed(0)}</p>
                    <p className="text-xs text-[#6B7280]">/{s.priceUnit?.replace("per_", "") ?? "job"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {recentReviews.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-4">{t("reviewsHeading")}</h2>
          <div className="space-y-4">
            {recentReviews.map((r) => (
              <div key={r.id} className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm text-[#2B3441]">★ {r.overallRating}/5</span>
                  {r.title && <span className="text-sm font-medium text-[#2B3441]">{r.title}</span>}
                  <span className="ml-auto text-xs text-[#6B7280]">{new Date(r.createdAt).toLocaleDateString("de-DE")}</span>
                </div>
                {r.body && <p className="text-sm text-[#6B7280] leading-relaxed">{r.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
