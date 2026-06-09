import { GoogleOneTap } from "@clerk/nextjs"
import Script from "next/script"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"

const UMAMI_URL = process.env.NEXT_PUBLIC_UMAMI_URL
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <GoogleOneTap />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      {UMAMI_URL && UMAMI_WEBSITE_ID && (
        <Script
          src={`${UMAMI_URL}/script.js`}
          data-website-id={UMAMI_WEBSITE_ID}
          strategy="afterInteractive"
        />
      )}
    </div>
  )
}
