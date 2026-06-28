// Canonical site constants for SEO. Override the URL per environment with
// NEXT_PUBLIC_SITE_URL (e.g. the www host) — defaults to the apex punycode domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://xn--dorix-fsa.com").replace(/\/+$/, "")
export const SITE_NAME = "DORIXÉ"
export const SITE_TAGLINE = "Clean Home. Green Future."
export const SITE_DESCRIPTION =
  "Book trusted, eco-friendly cleaners near you. Identity-verified cleaners, transparent per-hour pricing, and a greener home."

// The locales DORIXÉ serves (used for og:locale alternates and hreflang once
// URL-based i18n is enabled). en is the default served at the bare URL today.
export const LOCALES = ["en", "de", "fr", "es", "it", "nl", "pl", "pt"] as const

// Join a path onto SITE_URL into an absolute, canonical URL.
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}
