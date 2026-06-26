import { MapPin, Tag, CalendarCheck, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function HowItWorks() {
  const t = await getTranslations("homeHowItWorks")

  const STEPS = [
    { number: "01", Icon: MapPin, title: t("step1Title"), desc: t("step1Desc") },
    { number: "02", Icon: Tag, title: t("step2Title"), desc: t("step2Desc") },
    { number: "03", Icon: CalendarCheck, title: t("step3Title"), desc: t("step3Desc") },
    { number: "04", Icon: Sparkles, title: t("step4Title"), desc: t("step4Desc") },
  ]

  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-3">
            {t("heading")}
          </h2>
          <p className="text-[#6B7280] max-w-2xl mx-auto text-sm leading-relaxed">
            {t("subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {STEPS.map(({ number, Icon, title, desc }) => (
            <div key={number}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-5xl font-serif font-bold text-[#D1F0E0] leading-none">{number}</span>
                <div className="w-10 h-10 rounded-xl bg-[#F4FAF6] border border-[#E5EDE9] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#2D7A5F]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[#2B3441] mb-2">{title}</h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
