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

export async function ServiceGrid({ glass = false }: { glass?: boolean }) {
  const t = await getTranslations("homeServiceGrid")
  // Glass: no card box — icon + label sit directly on the hero photo. White text
  // with a strong dark halo keeps them readable over the image. The default
  // (non-glass) solid white cards are used anywhere with a plain background.
  const itemClass = glass
    ? "group flex flex-col p-1.5 cursor-pointer transition-all duration-200"
    : "group bg-white rounded-2xl p-4 shadow-sm border border-[#E5EDE9] hover:border-[#2D7A5F] hover:shadow-md transition-all duration-200 cursor-pointer"
  const iconClass = glass
    ? "text-2xl mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] transition-transform duration-200 group-hover:scale-110"
    : "text-2xl mb-2.5"
  const titleClass = glass
    ? "text-sm font-semibold text-white leading-tight mb-0.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] group-hover:text-[#7BD8A8] transition-colors"
    : "text-sm font-semibold text-[#2B3441] group-hover:text-[#2D7A5F] transition-colors leading-tight mb-0.5"
  const priceClass = glass
    ? "text-xs font-medium text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
    : "text-xs text-[#6B7280]"
  return (
    <div className={`grid grid-cols-2 ${glass ? "gap-x-6 gap-y-5" : "gap-3"}`}>
      {SERVICES.map((s) => (
        <Link
          key={s.slug}
          href={`/book?service=${s.slug}`}
          className={itemClass}
        >
          <div className={iconClass}>{s.icon}</div>
          <p className={titleClass}>
            {t(s.nameKey)}
          </p>
          <p className={priceClass}>{t("priceFrom", { price: s.from })}</p>
        </Link>
      ))}
    </div>
  )
}
