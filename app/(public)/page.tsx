import { HeroSection } from "@/components/home/HeroSection"
import { TrustTicker } from "@/components/home/TrustTicker"
import { HowItWorks } from "@/components/home/HowItWorks"
import { FeaturedProviders } from "@/components/home/FeaturedProviders"
import { EcoScoreBand } from "@/components/home/EcoScoreBand"
import { JobPostSection } from "@/components/home/JobPostSection"
import { Testimonials } from "@/components/home/Testimonials"
import { CtaBand } from "@/components/home/CtaBand"

export const metadata = {
  title: "DORIX — Clean Home. Green Future.",
  description:
    "Book trusted, eco-friendly cleaning professionals near you. Vetted providers, transparent pricing, and a green future for every home.",
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
