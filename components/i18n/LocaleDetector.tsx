"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { useCountryDetect } from "@/hooks/useCountryDetect"
import { localeFromCountry, type Locale } from "@/i18n/config"

function hasLocaleCookie(): boolean {
  return document.cookie.split("; ").some((r) => r.startsWith("locale="))
}

/**
 * First-visit, IP-location-based locale selection. The server already picks an
 * initial locale from Accept-Language; this refines it using the visitor's
 * detected country (via the existing /api/geo/country) and locks the choice in
 * a cookie so subsequent visits are stable and flash-free. A manual switch
 * (LanguageSwitcher) writes the same cookie and always wins.
 */
export function LocaleDetector() {
  const geo = useCountryDetect()
  const current = useLocale() as Locale
  const router = useRouter()

  useEffect(() => {
    if (hasLocaleCookie()) return // explicit choice or already detected
    if (!geo?.countryCode) return
    const target = localeFromCountry(geo.countryCode)
    document.cookie = `locale=${target}; path=/; max-age=31536000; samesite=lax`
    if (target !== current) router.refresh()
  }, [geo?.countryCode, current, router])

  return null
}
