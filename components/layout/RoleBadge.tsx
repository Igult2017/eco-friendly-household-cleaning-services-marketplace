"use client"

import { useTranslations } from "next-intl"
import { Leaf, Search } from "lucide-react"

// Shows which role/view a profile belongs to — "Cleaner" vs "Looking for a cleaner" — so users
// (especially dual-role accounts) aren't confused about which account they're editing.
export function RoleBadge({ variant }: { variant: "cleaner" | "client" }) {
  const t = useTranslations("roleBadge")
  const isCleaner = variant === "cleaner"
  return (
    <span
      className={
        isCleaner
          ? "inline-flex items-center gap-1.5 rounded-full bg-[#D1F0E0] text-[#2D7A5F] text-xs font-semibold px-3 py-1"
          : "inline-flex items-center gap-1.5 rounded-full bg-[#EAF1F8] text-[#2B3441] text-xs font-semibold px-3 py-1"
      }
    >
      {isCleaner ? <Leaf size={12} /> : <Search size={12} />}
      {isCleaner ? t("cleaner") : t("lookingForCleaner")}
    </span>
  )
}
