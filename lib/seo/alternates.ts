import { routing } from "@/i18n/routing"
import { SITE_URL } from "./site"

const base = SITE_URL.replace(/\/$/, "")

// localePrefix is "as-needed": the default locale is unprefixed (/about), others get a
// /<locale> prefix (/de/about). Pure string logic so it's safe during static prerender.
function localizedPath(href: string, locale: string): string {
  if (locale === routing.defaultLocale) return href
  return href === "/" ? `/${locale}` : `/${locale}${href}`
}

// Canonical + hreflang `languages` alternates for a public page. `href` is the locale-less
// path, e.g. "/about" or "/".
export function localeAlternates(
  href: string,
  currentLocale: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {}
  for (const locale of routing.locales) {
    languages[locale] = base + localizedPath(href, locale)
  }
  languages["x-default"] = base + localizedPath(href, routing.defaultLocale)
  return {
    // Self-referential canonical (this locale's own URL) — required for hreflang to work; a
    // cross-language canonical would tell Google the localized page is a duplicate of the default.
    canonical: base + localizedPath(href, currentLocale),
    languages,
  }
}
