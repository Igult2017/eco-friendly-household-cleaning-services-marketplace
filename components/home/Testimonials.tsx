import { Star } from "lucide-react"
import { getTranslations } from "next-intl/server"

const REVIEWS = [
  {
    key: "review1",
    rating: 5,
  },
  {
    key: "review2",
    rating: 5,
  },
  {
    key: "review3",
    rating: 5,
  },
]

export async function Testimonials() {
  const t = await getTranslations("homeTestimonials")
  return (
    <section className="py-20 bg-[#F4FAF6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-3">
            {t("heading")}
          </h2>
          <p className="text-[#6B7280] text-sm">{t("subheading")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {REVIEWS.map((review) => (
            <div key={review.key} className="bg-white rounded-2xl p-6 border border-[#E5EDE9] shadow-sm">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-[#2B3441] text-sm leading-relaxed mb-5 italic">"{t(`${review.key}Text`)}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#2B3441]">{t(`${review.key}Name`)}</p>
                  <p className="text-xs text-[#6B7280]">{t(`${review.key}City`)}</p>
                </div>
                <span className="text-[10px] bg-[#F4FAF6] text-[#6B7280] border border-[#E5EDE9] rounded-full px-2.5 py-1">
                  {t(`${review.key}Service`)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
