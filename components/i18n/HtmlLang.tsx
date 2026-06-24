"use client"

import { useEffect } from "react"

// The root <html lang> is static (defaultLocale) so public pages can prerender. On localized
// pages this corrects the document language client-side for a11y/SEO without forcing a dynamic
// render. hreflang alternates (in metadata) remain the primary signal for crawlers.
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== locale) document.documentElement.lang = locale
  }, [locale])
  return null
}
