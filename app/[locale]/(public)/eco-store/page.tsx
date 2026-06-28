export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { db } from "@/lib/db"
import { storeProducts } from "@/lib/db/schema"
import { eq, and, desc, asc } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { Leaf } from "lucide-react"
import { AffiliateDisclosure } from "@/components/store/AffiliateDisclosure"
import { ProductCard } from "@/components/store/ProductCard"
import { StarterPackCard } from "@/components/store/StarterPackCard"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ecoStore")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

// Ordering shared by both listing kinds: featured first, then admin sortOrder, then newest.
const ordering = [desc(storeProducts.featured), asc(storeProducts.sortOrder), desc(storeProducts.createdAt)]

async function getStarterPacks() {
  return db.query.storeProducts.findMany({
    where: and(eq(storeProducts.status, "published"), eq(storeProducts.type, "starter_pack")),
    orderBy: ordering,
  })
}

async function getProducts(category?: string) {
  return db.query.storeProducts.findMany({
    where: category
      ? and(
          eq(storeProducts.status, "published"),
          eq(storeProducts.type, "product"),
          eq(storeProducts.category, category)
        )
      : and(eq(storeProducts.status, "published"), eq(storeProducts.type, "product")),
    orderBy: ordering,
  })
}

async function getProductCategories() {
  const rows = await db
    .select({ category: storeProducts.category })
    .from(storeProducts)
    .where(and(eq(storeProducts.status, "published"), eq(storeProducts.type, "product")))
  return [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[]
}

export default async function EcoStorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const [starterPacks, products, categories] = await Promise.all([
    getStarterPacks(),
    getProducts(category),
    getProductCategories(),
  ])
  const t = await getTranslations("ecoStore")

  // Empty only when there's truly nothing published (ignore the active category filter).
  const nothingPublished = starterPacks.length === 0 && categories.length === 0

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Leaf size={18} className="text-[#2D7A5F]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest">
              {t("metaTitle")}
            </span>
          </div>
          <h1 className="font-serif text-4xl font-bold text-[#2B3441]">{t("title")}</h1>
          <p className="text-[#6B7280] mt-2 text-lg max-w-2xl">{t("subtitle")}</p>
        </div>

        {/* Affiliate disclosure */}
        <div className="mb-12">
          <AffiliateDisclosure />
        </div>

        {nothingPublished ? (
          <div className="text-center py-20 text-[#9CA3AF]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF5F0]">
              <Leaf size={26} className="text-[#2D7A5F]" aria-hidden="true" />
            </div>
            <p className="text-lg font-medium mb-1 text-[#2B3441]">{t("emptyTitle")}</p>
            <p className="text-sm">{t("emptyBody")}</p>
          </div>
        ) : (
          <>
            {/* Starter packs */}
            {starterPacks.length > 0 && (
              <section className="mb-16">
                <div className="mb-6">
                  <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("starterPacksTitle")}</h2>
                  <p className="text-[#6B7280] mt-1">{t("starterPacksSubtitle")}</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {starterPacks.map((pack) => (
                    <StarterPackCard key={pack.id} pack={pack} />
                  ))}
                </div>
              </section>
            )}

            {/* Recommended products */}
            <section>
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("productsTitle")}</h2>
                <p className="text-[#6B7280] mt-1">{t("productsSubtitle")}</p>
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  <Link
                    href="/eco-store"
                    className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                      !category
                        ? "bg-[#2D7A5F] text-white"
                        : "bg-white text-[#6B7280] border border-[#E5EBF0] hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
                    }`}
                  >
                    {t("allCategories")}
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat}
                      href={`/eco-store?category=${encodeURIComponent(cat)}`}
                      className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                        category === cat
                          ? "bg-[#2D7A5F] text-white"
                          : "bg-white text-[#6B7280] border border-[#E5EBF0] hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
                      }`}
                    >
                      {cat}
                    </Link>
                  ))}
                </div>
              )}

              {products.length === 0 ? (
                <div className="text-center py-16 text-[#9CA3AF]">
                  <p className="text-base font-medium mb-1 text-[#2B3441]">{t("emptyTitle")}</p>
                  <p className="text-sm">{t("emptyBody")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
