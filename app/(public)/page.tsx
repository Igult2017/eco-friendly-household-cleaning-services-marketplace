import { getTranslations } from "next-intl/server"
import { HeroSection } from "@/components/home/HeroSection"
import { TrustTicker } from "@/components/home/TrustTicker"
import { HowItWorks } from "@/components/home/HowItWorks"
import { FeaturedProviders } from "@/components/home/FeaturedProviders"
import { EcoScoreBand } from "@/components/home/EcoScoreBand"
import { JobPostSection } from "@/components/home/JobPostSection"
import { Testimonials } from "@/components/home/Testimonials"
import { CtaBand } from "@/components/home/CtaBand"

export async function generateMetadata() {
  const t = await getTranslations("homePage")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustTicker />
      <HowItWorks />
      <FeaturedProviders />
      <EcoScoreBand />
      <JobPostSection />
      <Testimonials />
      <CtaBand />
    </>
  )
}
