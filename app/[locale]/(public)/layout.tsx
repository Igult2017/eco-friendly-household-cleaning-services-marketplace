import Script from "next/script"
import { setRequestLocale } from "next-intl/server"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"

const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
// Use the configured app origin instead of reading request headers, so public pages stay static.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://xn--dorix-fsa.com").replace(/\/$/, "")

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const hostUrl = UMAMI_WEBSITE_ID ? `${APP_URL}/_a` : null

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      {UMAMI_WEBSITE_ID && hostUrl && (
        <Script
          src="/_a/script.js"
          data-website-id={UMAMI_WEBSITE_ID}
          data-host-url={hostUrl}
          strategy="afterInteractive"
        />
      )}
    </div>
  )
}
