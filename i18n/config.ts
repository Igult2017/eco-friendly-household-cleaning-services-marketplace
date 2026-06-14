// Supported locales for the DORIXÉ marketplace (EU-focused).
export const locales = ["en", "de", "fr", "es", "it", "nl", "pl", "pt"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}

// Native names + flags for the language switcher UI.
export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português",
}

export const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  pt: "🇵🇹",
}

// Map an ISO-3166 country code to the best-fit supported locale (for IP-based
// auto-detection). Countries not listed fall back to the default (English).
const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  ES: "es",
  IT: "it", SM: "it", VA: "it",
  NL: "nl",
  PL: "pl",
  PT: "pt",
  GB: "en", IE: "en", US: "en", MT: "en",
}

export function localeFromCountry(code?: string | null): Locale {
  if (!code) return defaultLocale
  return COUNTRY_TO_LOCALE[code.toUpperCase()] ?? defaultLocale
}

// Pick the first supported locale from an Accept-Language header value.
export function localeFromAcceptLanguage(header?: string | null): Locale | null {
  if (!header) return null
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=")
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  for (const { tag } of ranked) {
    const base = tag.split("-")[0]
    if (isLocale(base)) return base
  }
  return null
}
