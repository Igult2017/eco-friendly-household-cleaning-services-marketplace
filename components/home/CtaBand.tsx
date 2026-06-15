import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"

export async function CtaBand() {
  const t = await getTranslations("homeCta")

  return (
    <section className="py-16 bg-[#2B3441]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          🌿 {t("badge")}
        </div>
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
          {t("heading")}
        </h2>
        <p className="text-white/60 mb-8 max-w-md mx-auto text-sm leading-relaxed">
          {t("description")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/browse">
            <Button size="lg" className="bg-[#2D7A5F] hover:bg-[#4CB87A] text-white w-full sm:w-auto">
              {t("findCleaner")}
            </Button>
          </Link>
          <Link href="/become-a-cleaner">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto"
            >
              {t("becomeCleaner")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
