"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

const KEY = "dorix_cookie_consent"

export function CookieBanner() {
  const t = useTranslations("compGdprCookieBanner")
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true)
    // Let a footer "Cookie settings" link re-open the banner so consent can be withdrawn/changed.
    const open = () => setVisible(true)
    window.addEventListener("dorix-open-cookie-settings", open)
    return () => window.removeEventListener("dorix-open-cookie-settings", open)
  }, [])

  // Persist the choice and notify listeners (the analytics loader) so tracking starts/stops at once.
  const save = (analytics: boolean) => {
    localStorage.setItem(KEY, JSON.stringify({ analytics, marketing: false, ts: Date.now() }))
    window.dispatchEvent(new Event("dorix-consent-change"))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-20 md:p-6">
      <div className="max-w-3xl mx-auto bg-[#2B3441] rounded-2xl shadow-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <p className="text-white text-sm font-semibold mb-1">{t("title")}</p>
          <p className="text-white/70 text-xs leading-relaxed">
            {t("description")}{" "}
            <Link href="/legal/cookie-policy" className="underline text-[#4CB87A]">
              {t("cookiePolicyLink")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/legal/privacy" className="underline text-[#4CB87A]">
              {t("privacyPolicyLink")}
            </Link>.
          </p>
        </div>
        {/* Equal-weight Accept / Reject buttons (EU ePrivacy: rejecting must be as easy as accepting). */}
        <div className="flex gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={() => save(false)}
            className="flex-1 md:flex-none px-5 py-2 rounded-lg border border-white/25 bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            {t("decline")}
          </button>
          <button
            onClick={() => save(true)}
            className="flex-1 md:flex-none px-5 py-2 rounded-lg bg-[#2D7A5F] text-white text-sm font-semibold hover:bg-[#4CB87A] transition-colors"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  )
}
