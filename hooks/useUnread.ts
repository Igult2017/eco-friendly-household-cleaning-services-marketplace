"use client"

import { useEffect, useState } from "react"

export type UnreadNotif = { link: string | null }

/** Unread notifications for the signed-in user, refreshed every 30s (same cadence as the bell).
 * Used by the dashboard navs to show per-section badges. */
export function useUnread(): UnreadNotif[] {
  const [items, setItems] = useState<UnreadNotif[]>([])
  useEffect(() => {
    const load = () =>
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => setItems(((d.notifications ?? []) as { link: string | null; isRead: boolean }[]).filter((n) => !n.isRead)))
        .catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])
  return items
}
