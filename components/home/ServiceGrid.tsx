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
  // `glass` renders frosted, translucent cards that float over the hero photo;
  // the default solid white cards are used anywhere with a plain background.
  // Glass: very transparent so the hero photo shows through; darker text + a soft
  // white halo keep the labels readable over the (now lighter) image.
  const cardClass = glass
    ? "group bg-white/40 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/50 hover:bg-white/65 hover:border-white hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200 cursor-pointer"
    : "group bg-white rounded-2xl p-4 shadow-sm border border-[#E5EDE9] hover:border-[#2D7A5F] hover:shadow-md transition-all duration-200 cursor-pointer"
  const titleClass = glass
    ? "text-sm font-semibold text-[#1c2530] group-hover:text-[#2D7A5F] transition-colors leading-tight mb-0.5 [text-shadow:0_1px_2px_rgba(255,255,255,0.65)]"
    : "text-sm font-semibold text-[#2B3441] group-hover:text-[#2D7A5F] transition-colors leading-tight mb-0.5"
  const priceClass = glass
    ? "text-xs font-medium text-[#3f4854] [text-shadow:0_1px_2px_rgba(255,255,255,0.6)]"
    : "text-xs text-[#6B7280]"
  return (
    <div className="grid grid-cols-2 gap-3">
      {SERVICES.map((s) => (
        <Link
          key={s.slug}
          href={`/book?service=${s.slug}`}
          className={cardClass}
        >
          <div className="text-2xl mb-2.5">{s.icon}</div>
          <p className={titleClass}>
            {t(s.nameKey)}
          </p>
          <p className={priceClass}>{t("priceFrom", { price: s.from })}</p>
        </Link>
      ))}
    </div>
  )
}
