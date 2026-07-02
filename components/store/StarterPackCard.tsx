import { Check, Sparkles, ArrowRight, ExternalLink } from "lucide-react"
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

export async function StarterPackCard({ pack, members = [] }: { pack: StoreProduct; members?: StoreProduct[] }) {
  const t = await getTranslations("ecoStore")
  const price = formatPrice(pack.priceCents, pack.currency)
  const benefits = pack.benefits ?? []
  const hasOwnLink = !!pack.affiliateUrl

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-[#2D7A5F]/30 overflow-hidden hover:shadow-md transition-shadow">
      {/* eco-green top accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#2D7A5F] to-[#4CB87A]" aria-hidden="true" />

      {pack.imageUrl && (
        <div className="h-52 w-full overflow-hidden bg-[#F4FAF6]">
          {/* Affiliate images live on arbitrary external domains — plain img, not next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pack.imageUrl}
            alt={pack.title}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[#2D7A5F] bg-[#EDF5F0] px-3 py-1 rounded-full mb-4">
          <Sparkles size={12} aria-hidden="true" /> {t("starterPackBadge")}
        </span>

        {pack.brand && (
          <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">{pack.brand}</p>
        )}

        <h3 className="font-serif font-bold text-[#2B3441] text-2xl leading-snug mb-3">{pack.title}</h3>

        {pack.description && (
          <p className="text-sm text-[#6B7280] leading-relaxed mb-5">{pack.description}</p>
        )}

        {benefits.length > 0 && (
          <ul className="space-y-2.5 mb-6">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[#2B3441]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EDF5F0]">
                  <Check size={13} className="text-[#2D7A5F]" aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Member products — the pack as a titled LIST ("Top 10 …"), each product with its own
            description + benefits panel and its own affiliate link. */}
        {members.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280] mb-4">
              {t("packItemsTitle", { count: members.length })}
            </h4>
            <ol className="space-y-4">
              {members.map((m, i) => (
                <li key={m.id} className="rounded-xl border border-[#E5EBF0] bg-[#FAFCFB] p-4">
                  <div className="flex items-start gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D7A5F] text-xs font-bold text-white">{i + 1}</span>
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt={m.title} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover bg-white" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="font-semibold text-[#2B3441] leading-snug">{m.title}</p>
                        {formatPrice(m.priceCents, m.currency) && (
                          <span className="text-sm font-semibold text-[#2B3441]">{formatPrice(m.priceCents, m.currency)}</span>
                        )}
                      </div>
                      {m.brand && <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">{m.brand}</p>}
                      {m.description && <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">{m.description}</p>}
                      {(m.benefits ?? []).length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {(m.benefits ?? []).map((b, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-[#2B3441]">
                              <Check size={14} className="mt-0.5 shrink-0 text-[#2D7A5F]" aria-hidden="true" />
                              <span className="leading-relaxed">{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <a
                        href={`/api/store/go/${m.id}`}
                        target="_blank"
                        rel="sponsored nofollow noopener"
                        aria-label={`${t("viewProduct")}: ${m.title}`}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#2D7A5F]/40 px-3.5 py-1.5 text-sm font-medium text-[#2D7A5F] hover:bg-[#EDF5F0] transition-colors"
                      >
                        {t("viewProduct")}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(price || hasOwnLink) && (
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            {price && <span className="text-lg font-bold text-[#2B3441]">{price}</span>}
            {hasOwnLink && (
              <a
                href={`/api/store/go/${pack.id}`}
                target="_blank"
                rel="sponsored nofollow noopener"
                aria-label={`${t("getStarted")}: ${pack.title}`}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#2D7A5F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#235f49] transition-colors"
              >
                {t("getStarted")}
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
