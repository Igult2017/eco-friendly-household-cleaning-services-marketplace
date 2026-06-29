"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Briefcase, MessageSquare, CalendarDays, Menu } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/provider/dashboard", icon: Home, key: "home" },
  { href: "/provider/jobs", icon: Briefcase, key: "requests" },
  { href: "/provider/messages", icon: MessageSquare, key: "chat" },
  { href: "/provider/calendar", icon: CalendarDays, key: "calendar" },
  { href: "/provider/profile", icon: Menu, key: "more" },
] as const

export function ProviderMobileNav() {
  const t = useTranslations("providerMobileNav")
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {ITEMS.map((it) => {
          const active = pathname.startsWith(it.href)
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-[#2D7A5F]" : "text-[#6B7280]"
              )}
            >
              <it.icon size={20} className={active ? "text-[#2D7A5F]" : "text-[#9CA3AF]"} />
              {t(it.key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
