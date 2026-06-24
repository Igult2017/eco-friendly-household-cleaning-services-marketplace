import Link from "next/link"
import { Star, MapPin } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const PROVIDERS = [
  {
    id: "1",
    name: "Amara Green",
    city: "Amsterdam",
    rating: 4.9,
    reviews: 143,
    bio: "Passionate eco-cleaner with 8 years experience. Specialises in deep cleans using certified organic products.",
    services: ["Regular", "Deep Clean"],
    price: 28,
    ecoLabel: "Certified",
    initials: "AG",
    color: "#2D7A5F",
  },
  {
    id: "2",
    name: "Lucas Müller",
    city: "Berlin",
    rating: 4.8,
    reviews: 97,
    bio: "Move-in/out and office specialist. Zero-waste approach, reusable supplies, electric van.",
    services: ["Move-in/Out", "Office"],
    price: 32,
    ecoLabel: "Premium",
    initials: "LM",
    color: "#4CB87A",
  },
  {
    id: "3",
    name: "Sofia Petit",
    city: "Paris",
    rating: 5.0,
    reviews: 212,
    bio: "Top-rated 3 years running. GDPR-trained, carbon-neutral cleaning with plant-based products only.",
    services: ["Deep Clean", "Laundry"],
    price: 35,
    ecoLabel: "Zero Impact",
    initials: "SP",
    color: "#235f49",
  },
]

export async function FeaturedProviders() {
  const t = await getTranslations("homeFeaturedProviders")
  return (
    <section className="py-20 bg-[#F4FAF6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-2">
              {t("heading")}
            </h2>
            <p className="text-[#6B7280] text-sm">{t("subtitle")}</p>
          </div>
          <Link href="/browse" prefetch={false} className="hidden md:block">
            <Button variant="outline" className="border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#2D7A5F] hover:text-white">
              {t("viewAll")}
            </Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-5 border border-[#E5EDE9] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-semibold text-[#2B3441] text-sm">{p.name}</p>
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                    <MapPin className="w-3 h-3" />
                    {p.city}
                  </div>
                </div>
                <Badge className="text-[10px] bg-[#D1F0E0] text-[#2D7A5F] border-0 hover:bg-[#D1F0E0]">
                  🌿 {p.ecoLabel}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold text-[#2B3441]">{p.rating}</span>
                <span className="text-xs text-[#6B7280]">{t("reviewsCount", { count: p.reviews })}</span>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed mb-3 line-clamp-2">{p.bio}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {p.services.map((s) => (
                  <span key={s} className="text-[10px] bg-[#F4FAF6] text-[#2B3441] border border-[#E5EDE9] rounded-full px-2.5 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#2B3441]">
                  €{p.price}<span className="text-xs font-normal text-[#6B7280]">{t("perHour")}</span>
                </span>
                <div className="flex gap-2">
                  <Link href={`/providers/${p.id}`} prefetch={false}>
                    <Button variant="outline" size="sm" className="text-xs h-8 px-3">{t("view")}</Button>
                  </Link>
                  <Link href={`/book?provider=${p.id}`} prefetch={false}>
                    <Button size="sm" className="text-xs h-8 px-3 bg-[#2D7A5F] hover:bg-[#235f49] text-white">
                      {t("book")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
