import Link from "next/link"
import { MapPin, CheckCircle } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { ServiceGrid } from "./ServiceGrid"

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

            {/* Postcode search */}
            <div className="flex gap-2 mb-8 max-w-md">
              <label className="flex-1 flex items-center gap-2 bg-white border border-[#E5EDE9] rounded-xl px-4 py-3 shadow-sm focus-within:border-[#2D7A5F] transition-colors">
                <MapPin className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t("postcodePlaceholder")}
                  className="flex-1 text-sm outline-none text-[#2B3441] placeholder:text-[#9ca3af] bg-transparent"
                />
              </label>
              <Link href="/browse">
                <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-5 h-full whitespace-nowrap">
                  {t("findCleaners")}
                </Button>
              </Link>
            </div>

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
