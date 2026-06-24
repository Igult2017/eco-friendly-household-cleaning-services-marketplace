import { defineRouting } from "next-intl/routing"
import { locales, defaultLocale } from "./config"

// URL-based locale routing for PUBLIC pages (enables static, per-locale prerendering + SEO).
// "as-needed": the default locale (en) stays unprefixed at "/", others get a prefix (/de, /fr…).
// Reuses the existing "locale" cookie that the switcher/detector already set, so authenticated
// (non-prefixed) routes keep resolving locale from that same cookie.
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeCookie: { name: "locale" },
})
