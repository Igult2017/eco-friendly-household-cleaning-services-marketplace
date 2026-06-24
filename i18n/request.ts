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
