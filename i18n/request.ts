import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import { defaultLocale, isLocale, localeFromAcceptLanguage, type Locale } from "./config"

// Resolve the active locale server-side. Two paths:
//   1. PUBLIC routes under /[locale] → `requestLocale` is the URL segment. Using it (and NOT
//      reading cookies/headers) is what lets these pages render statically per locale.
//   2. Authenticated routes (no locale prefix) → `requestLocale` is undefined, so fall back to
//      the `locale` cookie, then the browser's Accept-Language, then the default (English).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  let locale: Locale | undefined = isLocale(requested) ? requested : undefined

  // A URL that carries a locale segment which ISN'T a real locale is junk, and must not be treated
  // like case 2. Automated scanners constantly probe /ads.txt, /humans.txt and /security.txt, and
  // because /[locale] is a dynamic segment at the top level, "ads.txt" arrives here AS the locale.
  // Falling through to the cookie read below made Next.js abandon a page it had already prerendered
  // as a static file — "Page changed from static to dynamic at runtime, reason: cookies" — filling
  // production logs with errors on every scan. Case 2 is specifically "no locale in the URL at
  // all", so it is keyed on that and nothing else. The junk request still 404s, from the
  // notFound() in app/[locale]/layout.tsx that was already there for exactly this.
  if (!locale && requested !== undefined) locale = defaultLocale

  if (!locale) {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get("locale")?.value
    if (isLocale(cookieLocale)) {
      locale = cookieLocale
    } else {
      const hdrs = await headers()
      locale = localeFromAcceptLanguage(hdrs.get("accept-language")) ?? defaultLocale
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
