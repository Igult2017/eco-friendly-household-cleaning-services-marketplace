"use client"

import Link from "next/link"
import { useUnread } from "@/hooks/useUnread"
import { useAutoClearSection } from "@/components/layout/CustomerNav"

type Labels = {
  dashboard: string; findJobs: string; bookings: string; calendar: string
  messages: string; earnings: string; pricing: string; support: string; profile: string
}

// Per-section unread badges, mapped by each notification's link. Matchers are DISJOINT (anything
// containing /messages counts only toward Messages) so a notification is never counted twice.
const ITEMS: { key: keyof Labels; href: string; match?: (l: string) => boolean }[] = [
  { key: "dashboard", href: "/provider/dashboard" },
  { key: "findJobs", href: "/provider/jobs", match: (l) => l.startsWith("/provider/jobs") && !l.includes("/messages") },
  { key: "bookings", href: "/provider/bookings", match: (l) => (l.startsWith("/provider/bookings") || l.startsWith("/bookings")) && !l.includes("/messages") },
  { key: "calendar", href: "/provider/calendar", match: (l) => l.startsWith("/provider/calendar") },
  { key: "messages", href: "/provider/messages", match: (l) => l.includes("/messages") },
  { key: "earnings", href: "/provider/earnings", match: (l) => l.startsWith("/provider/earnings") },
  { key: "pricing", href: "/provider/profile/services" },
  { key: "support", href: "/provider/support", match: (l) => l.startsWith("/provider/support") },
  { key: "profile", href: "/provider/profile" },
]

export function ProviderNav({ labels }: { labels: Labels }) {
  const unread = useUnread()
  useAutoClearSection(ITEMS, unread)
  const count = (m?: (l: string) => boolean) => (m ? unread.filter((n) => n.link && m(n.link)).length : 0)

  return (
    <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-[#6B7280]">
      {ITEMS.map((it) => {
        const c = count(it.match)
        return (
          <Link key={it.href} href={it.href} className="relative hover:text-[#2D7A5F] transition-colors">
            {labels[it.key]}
            {c > 0 && (
              <span className="absolute -right-3.5 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2D7A5F] px-1 text-[10px] font-bold leading-none text-white">
                {c > 9 ? "9+" : c}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
