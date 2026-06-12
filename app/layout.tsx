import type { Metadata } from "next"
import { Playfair_Display, Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { Toaster } from "@/components/ui/sonner"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { LanguagePopup } from "@/components/ui/LanguagePopup"
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
  title: {
    default: "DORIXÉ — Clean Home. Green Future.",
    template: "%s | DORIXÉ",
  },
  description:
    "Book trusted, eco-friendly cleaning professionals near you. Vetted providers, transparent pricing, and a green future for every home.",
  keywords: ["eco cleaning", "green cleaning service", "home cleaning", "sustainable cleaning", "EU cleaning marketplace"],
  openGraph: {
    type: "website",
    locale: "en_EU",
    siteName: "DORIXÉ",
    title: "DORIXÉ — Clean Home. Green Future.",
    description: "Book trusted, eco-friendly cleaning professionals near you.",
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  const html = (
    <html
      lang="en"
      className={cn("h-full", playfair.variable, inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster richColors position="top-right" />
        <CookieBanner />
        <LanguagePopup />
      </body>
    </html>
  )

  if (!publishableKey) return html

  return <ClerkProvider publishableKey={publishableKey}>{html}</ClerkProvider>
}
