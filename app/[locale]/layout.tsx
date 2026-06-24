import { setRequestLocale, getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { notFound } from "next/navigation"
import { routing } from "@/i18n/routing"
import { isLocale } from "@/i18n/config"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { LocaleDetector } from "@/components/i18n/LocaleDetector"
import { HtmlLang } from "@/components/i18n/HtmlLang"

// Prerender one variant of every public page per locale (the switch that makes them static).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Locale subtree for PUBLIC pages. The locale comes from the URL segment (not cookies/headers),
// so setRequestLocale lets everything below render statically. Provides the intl context + the
// per-locale shell that used to live in the (now static) root layout.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLang locale={locale} />
      {children}
      <CookieBanner />
      <LocaleDetector />
    </NextIntlClientProvider>
  )
}
