import { getTranslations } from "next-intl/server"

const STATS = [
  { id: "ecoScore", value: "4.8★" },
  { id: "co2Saved", value: "12.4t" },
  { id: "plantBased", value: "94%" },
  { id: "jobsDone", value: "3,200+" },
]

export async function EcoScoreBand() {
  const t = await getTranslations("homeEcoBand")
  return (
    <section className="bg-[#2D7A5F] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
            {t("heading")}
          </h2>
          <p className="text-white/60 text-sm">{t("subheading")}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ id, value }) => (
            <div key={id} className="text-center">
              <div className="text-3xl md:text-4xl font-serif font-bold text-white mb-1.5">
                {value}
              </div>
              <div className="text-white/60 text-xs tracking-wide">{t(`stat_${id}`)}</div>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-8 border-t border-white/10 text-center">
          <p className="text-white/50 text-xs">
            {t("footer")}
          </p>
        </div>
      </div>
    </section>
  )
}
