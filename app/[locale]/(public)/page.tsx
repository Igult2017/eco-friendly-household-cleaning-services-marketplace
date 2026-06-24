import { getTranslations, setRequestLocale } from "next-intl/server"
import { HeroSection } from "@/components/home/HeroSection"
import { TrustTicker } from "@/components/home/TrustTicker"
import { HowItWorks } from "@/components/home/HowItWorks"
import { WhatsIncluded } from "@/components/home/WhatsIncluded"
import { WhyChoose } from "@/components/home/WhyChoose"
import { FeaturedProviders } from "@/components/home/FeaturedProviders"
import { EcoScoreBand } from "@/components/home/EcoScoreBand"
import { JobPostSection } from "@/components/home/JobPostSection"
import { Testimonials } from "@/components/home/Testimonials"
import { CtaBand } from "@/components/home/CtaBand"

// ISR: prerendered static per locale, refreshed hourly (featured providers etc.).
export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "homePage" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <>
      <HeroSection />
      <TrustTicker />
      <HowItWorks />
      <WhatsIncluded />
      <WhyChoose />
      <FeaturedProviders />
      <EcoScoreBand />
      <JobPostSection />
      <Testimonials />
      <CtaBand />
    </>
  )
}
