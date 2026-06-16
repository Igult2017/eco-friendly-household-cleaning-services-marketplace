import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { ServiceGrid } from "./ServiceGrid"
import { HeroPostcodeSearch } from "./HeroPostcodeSearch"

export async function HeroSection() {
  const t = await getTranslations("homeHero")
  const TRUST = [
    t("trustVetted"),
    t("trustEcoCertified"),
    t("trustInsured"),
    t("trustInstantConfirmation"),
  ]
  return (
    <section className="bg-gradient-to-br from-[#F4FAF6] to-[#e8f5ed] py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#D1F0E0] text-[#2D7A5F] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              🌿 {t("badge")}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-[#2B3441] leading-[1.1] mb-5">
              {t("headlineLine1")}<br />
              <span className="text-[#2D7A5F]">{t("headlineLine2")}</span>
            </h1>
            <p className="text-lg text-[#6B7280] mb-8 max-w-md leading-relaxed">
              {t("subheadline")}
            </p>

            {/* Postcode search — checks real area availability (Step 1) */}
            <HeroPostcodeSearch
              placeholder={t("postcodePlaceholder")}
              buttonLabel={t("findCleaners")}
              checkingLabel={t("checking")}
              availableTemplate={t("availableNear")}
              noneLabel={t("noneNear")}
              viewLabel={t("viewCleaners")}
            />

            {/* Trust badges */}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {TRUST.map((badge) => (
                <div key={badge} className="flex items-center gap-1.5 text-xs text-[#2B3441]">
                  <CheckCircle className="w-3.5 h-3.5 text-[#2D7A5F] flex-shrink-0" />
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Right — service grid */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-4">
              {t("ourServices")}
            </p>
            <ServiceGrid />
            <p className="text-xs text-[#6B7280] mt-4 text-center">
              {t("orPrefix")}{" "}
              <Link href="/post-job" className="text-[#2D7A5F] font-semibold hover:underline">
                {t("postJobLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
