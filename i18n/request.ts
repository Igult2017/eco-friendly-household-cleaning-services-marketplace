import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import { defaultLocale, isLocale, localeFromAcceptLanguage, type Locale } from "./config"

// Resolve the active locale server-side, with no URL prefix:
//   1. explicit `locale` cookie (set by the switcher / IP detector), else
//   2. the browser's Accept-Language header, else
//   3. the default (English).
// This runs on the server for every request, so there is no language flash.
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get("locale")?.value

  let locale: Locale
  if (isLocale(cookieLocale)) {
    locale = cookieLocale
  } else {
    const hdrs = await headers()
    locale = localeFromAcceptLanguage(hdrs.get("accept-language")) ?? defaultLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
