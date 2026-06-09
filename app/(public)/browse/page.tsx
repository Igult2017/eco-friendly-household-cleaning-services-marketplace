export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { providers, users } from "@/lib/db/schema"
import { eq, desc, and, ilike, gte } from "drizzle-orm"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Browse Eco Cleaners — DORIX",
  description: "Find trusted, eco-certified cleaning professionals near you.",
}

const ecoLabels: Record<string, { label: string; color: string }> = {
  basic: { label: "Eco Basic", color: "bg-gray-100 text-gray-600" },
  certified: { label: "Eco Certified", color: "bg-green-100 text-green-700" },
  premium: { label: "Eco Premium", color: "bg-emerald-100 text-emerald-700" },
  zero_impact: { label: "Zero Impact", color: "bg-[#2D7A5F]/10 text-[#2D7A5F]" },
}

async function getProviders(filters: { city?: string; ecoLevel?: string; minRating?: string }) {
  const conditions: Parameters<typeof and>[0][] = [eq(providers.isApproved, true)]

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
    return rows
  } catch {
    return []
  }
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ city?: string; ecoLevel?: string; minRating?: string }> }) {
  const { city, ecoLevel, minRating } = await searchParams
  const providerList = await getProviders({ city, ecoLevel, minRating })

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <form method="GET" action="/browse" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#6B7280]">City</label>
          <input name="city" defaultValue={city ?? ""} placeholder="Amsterdam" className="rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#6B7280]">Eco Level</label>
          <select name="ecoLevel" defaultValue={ecoLevel ?? ""} className="rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="basic">Eco Basic</option>
            <option value="certified">Eco Certified</option>
            <option value="premium">Eco Premium</option>
            <option value="zero_impact">Zero Impact</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#6B7280]">Min Rating</label>
          <select name="minRating" defaultValue={minRating ?? ""} className="rounded-lg border border-[#E5EBF0] px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="3">3★ +</option>
            <option value="4">4★ +</option>
            <option value="4.5">4.5★ +</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white">Filter</button>
        {(city || ecoLevel || minRating) && (
          <a href="/browse" className="rounded-lg border border-[#E5EBF0] px-4 py-2 text-sm text-[#6B7280]">Clear</a>
        )}
      </form>
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-[#2B3441]">Find Eco Cleaners</h1>
        <p className="text-[#6B7280] mt-2">{providerList.length} {(city || ecoLevel || minRating) ? "providers match your filters" : "vetted providers available"}</p>
      </div>

      {providerList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#6B7280]">No providers found. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {providerList.map((p) => {
            const eco = ecoLabels[p.ecoLevel] ?? ecoLabels.basic
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

                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold mb-3 ${eco.color}`}>
                    🌿 {eco.label}
                  </span>
                  {p.verificationStatus === "verified" && (
                    <span className="ml-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">✓ Verified</span>
                  )}

                  {p.bio && (
                    <p className="text-sm text-[#6B7280] line-clamp-2 leading-relaxed mb-3">{p.bio}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-4">
                    <span className="font-medium text-[#2B3441]">★ {(p.averageRating ?? 0).toFixed(1)}</span>
                    <span>({p.totalReviews})</span>
                    <span>·</span>
                    <span>{p.totalJobsCompleted} jobs</span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/providers/${p.slug}`}
                      className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-sm font-medium text-[#6B7280] hover:border-[#2D7A5F] hover:text-[#2D7A5F] transition-colors"
                    >
                      View
                    </Link>
                    <Link
                      href={`/book?providerId=${p.id}`}
                      className="flex-1 rounded-lg bg-[#2D7A5F] py-2 text-center text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
                    >
                      Book
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
