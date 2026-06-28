"use client"

import Script from "next/script"
import { useState, useEffect } from "react"

const KEY = "dorix_cookie_consent"

function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    return JSON.parse(raw)?.analytics === true
  } catch {
    return false
  }
}

// Loads the Umami analytics script ONLY after the visitor has actively consented to analytics
// cookies (EU ePrivacy / GDPR require prior consent before any non-essential tracking). Default is
// deny: nothing loads until consent is granted. Re-checks on the "dorix-consent-change" event so
// tracking starts the moment the user accepts, without a page reload.
export function UmamiConsent({ websiteId, hostUrl }: { websiteId: string; hostUrl: string }) {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    const check = () => setConsented(hasAnalyticsConsent())
    check()
    window.addEventListener("dorix-consent-change", check)
    return () => window.removeEventListener("dorix-consent-change", check)
  }, [])

  if (!consented) return null

  return (
    <Script
      src="/_a/script.js"
      data-website-id={websiteId}
      data-host-url={hostUrl}
      strategy="afterInteractive"
    />
  )
}
