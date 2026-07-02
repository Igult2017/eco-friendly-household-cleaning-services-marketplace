import { Tag, ExternalLink, Check } from "lucide-react"
import { getTranslations } from "next-intl/server"
import type { StoreProduct } from "@/lib/db/schema"

function formatPrice(priceCents: number | null, currency: string | null) {
  if (priceCents == null) return null
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format(priceCents / 100)
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${currency || ""}`.trim()
  }
}

export async function ProductCard({ product }: { product: StoreProduct }) {
  const t = await getTranslations("ecoStore")
  const price = formatPrice(product.priceCents, product.currency)

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden hover:shadow-md transition-shadow">
      {product.imageUrl ? (
        <div className="h-48 w-full overflow-hidden bg-[#F4FAF6]">
          {/* Affiliate images live on arbitrary external domains — plain img, not next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-[#2D7A5F]/10 to-[#4CB87A]/20 flex items-center justify-center">
          <span className="text-4xl">🌿</span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {product.category && (
          <span className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[#2D7A5F] bg-[#EDF5F0] px-2 py-0.5 rounded-full mb-3">
            <Tag size={10} /> {product.category}
          </span>
        )}

        {product.brand && (
          <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">{product.brand}</p>
        )}

        <h3 className="font-serif font-bold text-[#2B3441] text-lg leading-snug mb-2 line-clamp-2">
          {product.title}
        </h3>

        {product.description && (
          <p className="text-sm text-[#6B7280] leading-relaxed line-clamp-2 mb-3">{product.description}</p>
        )}

        {/* Benefits panel — admin-written selling points for this product. */}
        {(product.benefits ?? []).length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {(product.benefits ?? []).slice(0, 4).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#2B3441]">
                <Check size={13} className="mt-0.5 shrink-0 text-[#2D7A5F]" aria-hidden="true" />
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          {price && <span className="font-semibold text-[#2B3441]">{price}</span>}
          <a
            href={`/api/store/go/${product.id}`}
            target="_blank"
            rel="sponsored nofollow noopener"
            aria-label={`${t("viewProduct")}: ${product.title}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#235f49] transition-colors"
          >
            {t("viewProduct")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  )
}
