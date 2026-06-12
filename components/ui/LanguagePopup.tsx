"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useCountryDetect } from "@/hooks/useCountryDetect"

interface LangEntry {
  name: string
  nativeName: string
  flag: string
}

const COUNTRY_LANG: Record<string, LangEntry> = {
  // Germanic
  DE: { name: "German",       nativeName: "Deutsch",         flag: "🇩🇪" },
  AT: { name: "German",       nativeName: "Deutsch",         flag: "🇦🇹" },
  CH: { name: "German",       nativeName: "Deutsch",         flag: "🇨🇭" },
  LU: { name: "Luxembourgish", nativeName: "Lëtzebuergesch", flag: "🇱🇺" },
  // Romance
  FR: { name: "French",       nativeName: "Français",        flag: "🇫🇷" },
  BE: { name: "French",       nativeName: "Français",        flag: "🇧🇪" },
  ES: { name: "Spanish",      nativeName: "Español",         flag: "🇪🇸" },
  IT: { name: "Italian",      nativeName: "Italiano",        flag: "🇮🇹" },
  PT: { name: "Portuguese",   nativeName: "Português",       flag: "🇵🇹" },
  RO: { name: "Romanian",     nativeName: "Română",          flag: "🇷🇴" },
  // Dutch
  NL: { name: "Dutch",        nativeName: "Nederlands",      flag: "🇳🇱" },
  // Nordic
  SE: { name: "Swedish",      nativeName: "Svenska",         flag: "🇸🇪" },
  DK: { name: "Danish",       nativeName: "Dansk",           flag: "🇩🇰" },
  FI: { name: "Finnish",      nativeName: "Suomi",           flag: "🇫🇮" },
  NO: { name: "Norwegian",    nativeName: "Norsk",           flag: "🇳🇴" },
  // Central & Eastern European
  PL: { name: "Polish",       nativeName: "Polski",          flag: "🇵🇱" },
  CZ: { name: "Czech",        nativeName: "Čeština",         flag: "🇨🇿" },
  SK: { name: "Slovak",       nativeName: "Slovenčina",      flag: "🇸🇰" },
  HU: { name: "Hungarian",    nativeName: "Magyar",          flag: "🇭🇺" },
  SI: { name: "Slovenian",    nativeName: "Slovenščina",     flag: "🇸🇮" },
  HR: { name: "Croatian",     nativeName: "Hrvatski",        flag: "🇭🇷" },
  BG: { name: "Bulgarian",    nativeName: "Български",       flag: "🇧🇬" },
  // Baltic
  LT: { name: "Lithuanian",   nativeName: "Lietuvių",        flag: "🇱🇹" },
  LV: { name: "Latvian",      nativeName: "Latviešu",        flag: "🇱🇻" },
  EE: { name: "Estonian",     nativeName: "Eesti",           flag: "🇪🇪" },
  // Greek
  GR: { name: "Greek",        nativeName: "Ελληνικά",        flag: "🇬🇷" },
  CY: { name: "Greek",        nativeName: "Ελληνικά",        flag: "🇨🇾" },
}

const DISMISS_KEY = "dorix_lang_popup_dismissed"

export function LanguagePopup() {
  const geo = useCountryDetect()
  const [visible, setVisible] = useState(false)
  const [lang, setLang] = useState<LangEntry | null>(null)

  useEffect(() => {
    if (!geo?.countryCode) return
    if (localStorage.getItem(DISMISS_KEY)) return
    const entry = COUNTRY_LANG[geo.countryCode]
    if (!entry) return
    setLang(entry)
    setVisible(true)
  }, [geo?.countryCode])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1")
    setVisible(false)
  }

  if (!visible || !lang || !geo) return null

  return (
    <div
      role="dialog"
      aria-label="Language suggestion"
      className="fixed bottom-4 left-4 z-50 w-80 rounded-2xl bg-white border border-[#E5EDE9] shadow-lg p-4 animate-in slide-in-from-bottom-2 duration-300"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss language popup"
        className="absolute top-3 right-3 text-[#9CA3AF] hover:text-[#2B3441] transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <span className="text-2xl leading-none mt-0.5">{lang.flag}</span>
        <div>
          <p className="text-sm font-semibold text-[#2B3441] mb-0.5">
            We noticed you&apos;re in {geo.country}
          </p>
          <p className="text-xs text-[#6B7280] leading-snug mb-3">
            DORIXÉ is currently in English.{" "}
            <span className="font-medium text-[#2D7A5F]">{lang.nativeName}</span> support is coming soon.
          </p>
          <button
            onClick={dismiss}
            className="text-xs font-semibold text-white bg-[#2D7A5F] hover:bg-[#235f49] px-3 py-1.5 rounded-lg transition-colors"
          >
            Continue in English
          </button>
        </div>
      </div>
    </div>
  )
}
