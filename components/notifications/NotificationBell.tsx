"use client"

import { useState, useEffect, useRef } from "react"
import { Bell } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

type Notification = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const t = useTranslations("compNotificationsNotificationBell")
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => setNotifs(d.notifications ?? []))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const unread = notifs.filter((n) => !n.isRead).length

  const markRead = async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={t("ariaNotifications")}
      >
        <Bell className="h-5 w-5 text-[#2B3441]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#2B3441]">{t("title")}</p>
            {unread > 0 && <span className="text-xs text-[#6B7280]">{t("unreadCount", { count: unread })}</span>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 ? (
              <p className="text-center py-8 text-sm text-[#6B7280]">{t("empty")}</p>
            ) : (
              notifs.map((n) => {
                const Wrapper = n.link ? Link : "div" as any
                return (
                  <Wrapper
                    key={n.id}
                    href={n.link ?? ""}
                    onClick={() => { markRead(n.id); setOpen(false) }}
                    className={`block px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? "bg-[#2D7A5F]/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-[#2D7A5F] shrink-0" />}
                      <div className={!n.isRead ? "" : "ml-5"}>
                        <p className="text-sm font-medium text-[#2B3441]">{n.title}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-[#6B7280] mt-1">{new Date(n.createdAt).toLocaleString("de-DE")}</p>
                      </div>
                    </div>
                  </Wrapper>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
