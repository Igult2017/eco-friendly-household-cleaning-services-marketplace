import Link from "next/link"
import { getTranslations } from "next-intl/server"

const SERVICES = [
  { icon: "🌿", nameKey: "regularCleaning", from: "€25", slug: "regular-cleaning" },
  { icon: "✨", nameKey: "deepCleaning", from: "€60", slug: "deep-cleaning" },
  { icon: "📦", nameKey: "moveCleaning", from: "€80", slug: "move-cleaning" },
  { icon: "🏢", nameKey: "officeCleaning", from: "€40", slug: "office-cleaning" },
  { icon: "👕", nameKey: "laundry", from: "€15", slug: "laundry" },
  { icon: "🪟", nameKey: "windowCleaning", from: "€20", slug: "window-cleaning" },
]

export async function ServiceGrid() {
  const t = await getTranslations("homeServiceGrid")
  return (
    <div className="grid grid-cols-2 gap-3">
      {SERVICES.map((s) => (
        <Link
          key={s.slug}
          href={`/book?service=${s.slug}`}
          className="group bg-white rounded-2xl p-4 shadow-sm border border-[#E5EDE9] hover:border-[#2D7A5F] hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div className="text-2xl mb-2.5">{s.icon}</div>
          <p className="text-sm font-semibold text-[#2B3441] group-hover:text-[#2D7A5F] transition-colors leading-tight mb-0.5">
            {t(s.nameKey)}
          </p>
          <p className="text-xs text-[#6B7280]">{t("priceFrom", { price: s.from })}</p>
        </Link>
      ))}
    </div>
  )
}
