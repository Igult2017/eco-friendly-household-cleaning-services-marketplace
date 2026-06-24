import { Link } from "@/i18n/navigation"
import NextLink from "next/link"
import { Leaf } from "lucide-react"
import { getTranslations } from "next-intl/server"

const SECTIONS = [
  {
    key: "product",
    links: [
      { key: "browseCleaners", href: "/browse" },
      { key: "postAJob", href: "/post-job" },
      { key: "howItWorks", href: "/#how-it-works" },
      { key: "pricing", href: "/pricing" },
    ],
  },
  {
    key: "company",
    links: [
      { key: "aboutUs", href: "/about" },
      { key: "sustainability", href: "/sustainability" },
      { key: "becomeACleaner", href: "/become-a-cleaner" },
      { key: "affiliateProgramme", href: "/affiliate" },
      { key: "blog", href: "/blog" },
    ],
  },
  {
    key: "legal",
    links: [
      { key: "privacyPolicy", href: "/legal/privacy" },
      { key: "termsOfService", href: "/legal/terms" },
      { key: "cookiePolicy", href: "/legal/cookie-policy" },
      { key: "legalNotice", href: "/legal/impressum" },
    ],
  },
]

// Auth-only routes have no /[locale] variant, so they must NOT be locale-prefixed — keep next/link.
const AUTH_HREFS = new Set<string>(["/post-job"])

export async function Footer() {
  const t = await getTranslations("footer")
  return (
    <footer className="bg-[#2B3441] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#2D7A5F] flex items-center justify-center flex-shrink-0">
                <Leaf className="w-3 h-3 text-white" />
              </div>
              <span className="font-serif font-bold text-white text-lg tracking-tight leading-none">DORIXÉ</span>
            </div>
            <p className="text-sm leading-relaxed text-white/50 max-w-[200px]">
              {t("taglineLine1")}<br />
              {t("taglineLine2")}
            </p>
          </div>
          {SECTIONS.map(({ key, links }) => (
            <div key={key}>
              <h4 className="text-white text-sm font-semibold mb-4">{t(`section_${key}`)}</h4>
              <ul className="space-y-2.5">
                {links.map(({ key: linkKey, href }) => (
                  <li key={href}>
                    {AUTH_HREFS.has(href) ? (
                      <NextLink href={href} className="text-sm hover:text-white transition-colors">
                        {t(`link_${linkKey}`)}
                      </NextLink>
                    ) : (
                      <Link href={href} className="text-sm hover:text-white transition-colors">
                        {t(`link_${linkKey}`)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <p>{t("copyright")}</p>
          <p>{t("compliance")}</p>
        </div>
      </div>
    </footer>
  )
}
