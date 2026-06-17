import { ShieldCheck, Tag, CalendarClock, Lock, Leaf } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function WhyChoose() {
  const t = await getTranslations("homeWhyChoose")

  const REASONS = [
    { Icon: ShieldCheck, title: t("reason1Title"), desc: t("reason1Desc") },
    { Icon: Tag, title: t("reason2Title"), desc: t("reason2Desc") },
    { Icon: CalendarClock, title: t("reason3Title"), desc: t("reason3Desc") },
    { Icon: Lock, title: t("reason4Title"), desc: t("reason4Desc") },
    { Icon: Leaf, title: t("reason5Title"), desc: t("reason5Desc") },
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-3">
            {t("heading")}
          </h2>
          <p className="text-[#6B7280] max-w-xl mx-auto text-sm leading-relaxed">
            {t("subheading")}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {REASONS.map(({ Icon, title, desc }, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#E5EDE9] bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-[#EDF5F0] flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#2D7A5F]" />
              </div>
              <h3 className="text-base font-semibold text-[#2B3441] mb-1.5">{title}</h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing + Payment & trust — folded into one reassurance band */}
        <div className="mt-10 max-w-3xl mx-auto rounded-2xl bg-[#F4FAF6] border border-[#E5EDE9] px-6 py-5 text-center">
          <p className="text-sm text-[#2B3441] leading-relaxed">{t("trustNote")}</p>
        </div>
      </div>
    </section>
  )
}
