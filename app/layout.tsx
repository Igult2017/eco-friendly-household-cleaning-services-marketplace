import type { Metadata } from "next"
import { Playfair_Display, Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { Toaster } from "@/components/ui/sonner"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { LocaleDetector } from "@/components/i18n/LocaleDetector"
import { RoleSwitchToast } from "@/components/layout/RoleSwitchToast"
import { JsonLd } from "@/components/seo/JsonLd"
import { organizationSchema, websiteSchema } from "@/lib/seo/schemas"
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo/site"
import { cn } from "@/lib/utils"
import "./globals.css"

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DORIXÉ — Eco-Friendly Cleaning Marketplace | Clean Home. Green Future.",
    template: "%s | DORIXÉ",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "eco cleaning",
    "eco-friendly cleaning service",
    "green cleaning service",
    "house cleaning near me",
    "non-toxic cleaning",
    "sustainable cleaning",
    "deep cleaning service",
    "end of tenancy cleaning",
    "office cleaning",
    "cleaning marketplace",
    "book a cleaner online",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "DORIXÉ — Eco-Friendly Cleaning Marketplace",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "DORIXÉ — eco-friendly cleaning marketplace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DORIXÉ — Eco-Friendly Cleaning Marketplace",
    description: SITE_DESCRIPTION,
    images: ["/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
  category: "Home services",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const locale = await getLocale()

  const html = (
    <html
      lang={locale}
      className={cn("h-full", playfair.variable, inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <NextIntlClientProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
          <Toaster richColors position="top-right" />
          <CookieBanner />
          <LocaleDetector />
          <RoleSwitchToast />
        </NextIntlClientProvider>
      </body>
    </html>
  )

  if (!publishableKey) return html

  return <ClerkProvider publishableKey={publishableKey}>{html}</ClerkProvider>
}
