"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarPlus, ClipboardList, MessageSquare, Menu } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/dashboard", icon: Home, key: "navDashboard" },
  { href: "/book", icon: CalendarPlus, key: "navBook" },
  { href: "/bookings", icon: ClipboardList, key: "navBookings" },
  { href: "/messages", icon: MessageSquare, key: "navMessages" },
  { href: "/profile", icon: Menu, key: "navProfile" },
] as const

export function CustomerMobileNav() {
  const t = useTranslations("customerLayout")
  const pathname = usePathname()
  // Precise match so /book doesn't also light up on /bookings (prefix collision).
  const match = (href: string) => pathname === href || pathname.startsWith(href + "/")
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {ITEMS.map((it) => {
          const onAnotherTab = ITEMS.some((o) => o.key !== "navProfile" && match(o.href))
          const active = it.key === "navProfile" ? match(it.href) || !onAnotherTab : match(it.href)
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
