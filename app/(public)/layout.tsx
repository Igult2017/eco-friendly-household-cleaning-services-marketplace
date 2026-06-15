import { GoogleOneTap } from "@clerk/nextjs"
import Script from "next/script"
import { headers } from "next/headers"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"

const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Umami is proxied through our own HTTPS origin at /_a (see next.config rewrites),
  // so both the tracker script and event collection are same-origin — no mixed content.
  let hostUrl: string | null = null
  if (UMAMI_WEBSITE_ID) {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    const proto = h.get("x-forwarded-proto") ?? "https"
    if (host) hostUrl = `${proto}://${host}/_a`
  }

  return (
    <div className="flex flex-col min-h-screen">
      <GoogleOneTap />
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
