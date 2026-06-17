import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { ServiceGrid } from "./ServiceGrid"
import { HeroPostcodeSearch } from "./HeroPostcodeSearch"
import { HeroBackground } from "./HeroBackground"

export async function HeroSection() {
  const t = await getTranslations("homeHero")
  const TRUST = [
    t("trustVetted"),
    t("trustEcoCertified"),
    t("trustInsured"),
    t("trustInstantConfirmation"),
  ]
  return (
    <section className="relative isolate overflow-hidden py-16 md:py-24">
      {/* Full-bleed background — seven cleaning photos that gently crossfade
          (decorative; the text conveys all meaning) */}
      <HeroBackground />
      {/* Contrast scrim — vertical layer tames the bright top of the photo so the
          headline stays readable; horizontal layer deepens the left for the text column. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0d1f16]/40 via-[#0d1f16]/18 to-[#0d1f16]/12"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0d1f16]/80 via-[#0d1f16]/30 to-transparent"
      />
      {/* Bottom blend into the page background */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#F4FAF6] to-transparent"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              🌿 {t("badge")}
            </div>
            {/* Each line is wrapped in a span so the global `h1 { color }` rule (unlayered,
                wins over Tailwind's layered text-* utilities) doesn't force charcoal text. */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-[1.1] mb-5 [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
              <span className="text-white">{t("headlineLine1")}</span><br />
              <span className="text-[#7BD8A8]">{t("headlineLine2")}</span>
            </h1>
            <p className="text-lg text-white/90 mb-8 max-w-md leading-relaxed drop-shadow-sm">
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
                <div key={badge} className="flex items-center gap-1.5 text-xs font-medium text-white drop-shadow-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-[#7BD8A8] flex-shrink-0" />
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Right — service grid (frosted glass over the photo) */}
          <div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-widest mb-4 drop-shadow-sm">
              {t("ourServices")}
            </p>
            <ServiceGrid glass />
            <p className="text-xs text-white/85 mt-4 text-center drop-shadow-sm">
              {t("orPrefix")}{" "}
              <Link href="/post-job" className="text-[#7BD8A8] font-semibold hover:underline">
                {t("postJobLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
