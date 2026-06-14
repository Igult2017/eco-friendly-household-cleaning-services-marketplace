"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { Globe, Check, ChevronDown } from "lucide-react"
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config"

export function LanguageSwitcher() {
  const current = useLocale() as Locale
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function choose(l: Locale) {
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`
    setOpen(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#2B3441] hover:bg-gray-100 transition-colors disabled:opacity-60"
      >
        <Globe size={15} className="text-[#6B7280]" />
        <span className="hidden sm:inline">{localeFlags[current]}</span>
        <span className="uppercase">{current}</span>
        <ChevronDown size={13} className={`text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#E5EDE9] bg-white py-1 shadow-lg"
        >
          {locales.map((l) => (
            <li key={l}>
              <button
                role="option"
                aria-selected={l === current}
                onClick={() => choose(l)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[#F4FAF6] ${
                  l === current ? "font-semibold text-[#2D7A5F]" : "text-[#2B3441]"
                }`}
              >
                <span className="text-base leading-none">{localeFlags[l]}</span>
                <span className="flex-1 text-left">{localeNames[l]}</span>
                {l === current && <Check size={14} className="text-[#2D7A5F]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
