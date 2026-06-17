import { Check } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function WhatsIncluded() {
  const t = await getTranslations("homeWhatsIncluded")
  const ITEMS = [t("item1"), t("item2"), t("item3"), t("item4"), t("item5")]

  return (
    <section className="py-20 bg-[#F4FAF6]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-3">
            {t("heading")}
          </h2>
          <p className="text-[#6B7280] max-w-xl mx-auto text-sm leading-relaxed">
            {t("subheading")}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-white rounded-2xl border border-[#E5EDE9] shadow-sm p-5"
            >
              <div className="w-6 h-6 rounded-full bg-[#D1F0E0] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-[#2D7A5F]" />
              </div>
              <p className="text-sm text-[#2B3441] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
