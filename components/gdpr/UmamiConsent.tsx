"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
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

declare global {
  interface Window {
    umami?: { track: () => void }
  }
}

// Loads the Umami analytics script ONLY after the visitor has actively consented to analytics
// cookies (EU ePrivacy / GDPR require prior consent before any non-essential tracking). Default is
// deny: nothing loads until consent is granted. Re-checks on the "dorix-consent-change" event so
// tracking starts the moment the user accepts, without a page reload.
//
// data-auto-track is OFF on purpose. Umami's script otherwise hooks the browser's own navigation
// mechanism for as long as the tab stays open, so once a visitor clicks from a public page into a
// role-gated area (admin/cleaner dashboards, where this component never renders) it kept reporting
// those page views too — confirmed live: a fake same-tab move to /admin/dashboard with no real
// admin page loading still produced a recorded visit. Firing track() by hand, only from this
// component's own effect, means tracking stops the moment this component unmounts (i.e. the
// visitor has left the public-pages area) instead of running indefinitely.
export function UmamiConsent({ websiteId, hostUrl }: { websiteId: string; hostUrl: string }) {
  const [consented, setConsented] = useState(false)
  const [scriptReady, setScriptReady] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const check = () => setConsented(hasAnalyticsConsent())
    check()
    window.addEventListener("dorix-consent-change", check)
    return () => window.removeEventListener("dorix-consent-change", check)
  }, [])

  useEffect(() => {
    if (!scriptReady) return
    window.umami?.track()
  }, [pathname, scriptReady])

  if (!consented) return null

  return (
    <Script
      src="/_a/script.js"
      data-website-id={websiteId}
      data-host-url={hostUrl}
      data-auto-track="false"
      strategy="afterInteractive"
      onLoad={() => setScriptReady(true)}
    />
  )
}
