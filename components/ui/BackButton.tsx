"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { useTranslations } from "next-intl"

// History-aware back: returns the user to where they actually came from; on a deep link (no
// in-app history) it falls back to the page's natural parent.
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter()
  const t = useTranslations("compBackButton")
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      className="inline-flex items-center gap-1 text-sm text-[#6B7280] transition-colors hover:text-[#2B3441]"
    >
      <ChevronLeft size={15} /> {t("back")}
    </button>
  )
}
