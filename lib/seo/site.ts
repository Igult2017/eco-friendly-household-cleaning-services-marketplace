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

// Public contact addresses. Defined once here so the footer, the contact page and the structured
// data search engines read can never drift apart.
export const CONTACT_EMAIL = "info@dorixe.com"
export const SUPPORT_EMAIL = "support@dorixe.com"

// DORIXÉ's own profiles. Tracking parameters have been stripped from the links as supplied
// (TikTok's `?_r=&_t=` and Instagram's `?igsi=` are per-device share tokens from whoever copied
// them) — they would leak one person's share session into every page and are rejected as identity
// evidence in `sameAs`, which must point at the canonical profile.
// The Facebook link is kept in its `/share/…` form because that is the only address supplied; it
// resolves to the page, but swap it for the page's own vanity URL when there is one.
export const SOCIAL_PROFILES = {
  facebook: "https://www.facebook.com/share/1BStC2nYwK/",
  instagram: "https://www.instagram.com/dorixecleaning",
  linkedin: "https://www.linkedin.com/company/dorix%C3%A9/",
  tiktok: "https://www.tiktok.com/@dorix796",
} as const
