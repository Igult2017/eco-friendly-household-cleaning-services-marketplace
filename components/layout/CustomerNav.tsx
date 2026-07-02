"use client"

import Link from "next/link"
import { useUnread } from "@/hooks/useUnread"

type Labels = {
  dashboard: string; book: string; bookings: string; postJob: string; myJobs: string
  messages: string; payments: string; notifications: string; support: string; profile: string
}

// Per-section unread badges by notification link — disjoint matchers (see ProviderNav).
// The Notifications item shows the TOTAL unread count (it is the notifications page).
const ITEMS: { key: keyof Labels; href: string; match?: ((l: string) => boolean) | "all" }[] = [
  { key: "dashboard", href: "/dashboard", match: (l) => l.startsWith("/dashboard") },
  { key: "book", href: "/book" },
  { key: "bookings", href: "/bookings", match: (l) => l.startsWith("/bookings") && !l.includes("/messages") },
  { key: "postJob", href: "/post-job" },
  { key: "myJobs", href: "/jobs", match: (l) => l.startsWith("/jobs") && !l.includes("/messages") },
  { key: "messages", href: "/messages", match: (l) => l.includes("/messages") },
  { key: "payments", href: "/payments", match: (l) => l.startsWith("/payments") },
  { key: "notifications", href: "/notifications", match: "all" },
  { key: "support", href: "/support", match: (l) => l.startsWith("/support") },
  { key: "profile", href: "/profile" },
]

export function CustomerNav({ labels }: { labels: Labels }) {
  const unread = useUnread()

  return (
    <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-[#6B7280]">
      {ITEMS.map((it) => {
        const c = it.match === "all" ? unread.length : it.match ? unread.filter((n) => n.link && (it.match as (l: string) => boolean)(n.link)).length : 0
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
