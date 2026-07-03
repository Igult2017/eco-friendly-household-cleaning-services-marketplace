"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUnread, clearUnread } from "@/hooks/useUnread"

type Labels = {
  dashboard: string; book: string; bookings: string; postJob: string; myJobs: string
  messages: string; payments: string; notifications: string; support: string; profile: string
}

// Per-section unread badges by notification link — matchers are DISJOINT, so one notification is
// counted in exactly ONE place (the bell is the only global total; the Notifications item carries
// no badge to avoid triple-counting). Opening a section marks its notifications read.
const ITEMS: { key: keyof Labels; href: string; match?: (l: string) => boolean }[] = [
  { key: "dashboard", href: "/dashboard", match: (l) => l.startsWith("/dashboard") },
  { key: "book", href: "/book" },
  { key: "bookings", href: "/bookings", match: (l) => l.startsWith("/bookings") && !l.includes("/messages") },
  { key: "postJob", href: "/post-job" },
  { key: "myJobs", href: "/jobs", match: (l) => l.startsWith("/jobs") && !l.includes("/messages") },
  { key: "messages", href: "/messages", match: (l) => l.includes("/messages") },
  { key: "payments", href: "/payments", match: (l) => l.startsWith("/payments") },
  { key: "notifications", href: "/notifications" },
  { key: "support", href: "/support", match: (l) => l.startsWith("/support") },
  { key: "profile", href: "/profile" },
]

/** Shared by both navs: when the user OPENS a section, its unread notifications are marked read —
 * seeing the content is reading it. A ref guards against re-PATCHing while the refetch is in flight. */
export function useAutoClearSection(items: { href: string; match?: (l: string) => boolean }[], unread: { id: string; link: string | null }[]) {
  const pathname = usePathname()
  const cleared = useRef<Set<string>>(new Set())
  useEffect(() => {
    const open = items.filter(
      (it) => it.match && (pathname === it.href || pathname.startsWith(it.href + "/") || it.match(pathname)),
    )
    if (!open.length) return
    const ids = unread
      .filter((n) => n.link && open.some((it) => it.match!(n.link!)) && !cleared.current.has(n.id))
      .map((n) => n.id)
    if (!ids.length) return
    ids.forEach((i) => cleared.current.add(i))
    void clearUnread(ids)
  }, [pathname, unread, items])
}

export function CustomerNav({ labels }: { labels: Labels }) {
  const unread = useUnread()
  useAutoClearSection(ITEMS, unread)

  return (
    <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-[#6B7280]">
      {ITEMS.map((it) => {
        const c = it.match ? unread.filter((n) => n.link && it.match!(n.link)).length : 0
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
