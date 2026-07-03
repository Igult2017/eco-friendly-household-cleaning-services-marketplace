"use client"

import { useEffect, useState } from "react"

export type UnreadNotif = { id: string; link: string | null }

// One shared signal: any component that changes read-state pings, every badge refetches instantly
// (the 30s poll is only a fallback). Without this the bell and the navs each held their own stale copy.
export const UNREAD_EVENT = "dorix:unread-changed"

export function pingUnread() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(UNREAD_EVENT))
}

/** Mark the given notifications read and refresh every badge on the page. */
export async function clearUnread(ids: string[]) {
  if (!ids.length) return
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
  } catch { /* badge clears on next poll */ }
  pingUnread()
}

/** Unread notifications for the signed-in user — polled every 30s AND refreshed instantly on
 * UNREAD_EVENT. Used by the dashboard navs for per-section badges. */
export function useUnread(): UnreadNotif[] {
  const [items, setItems] = useState<UnreadNotif[]>([])
  useEffect(() => {
    const load = () =>
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) =>
          setItems(
            ((d.notifications ?? []) as { id: string; link: string | null; isRead: boolean }[])
              .filter((n) => !n.isRead)
              .map((n) => ({ id: n.id, link: n.link })),
          ),
        )
        .catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    window.addEventListener(UNREAD_EVENT, load)
    return () => { clearInterval(t); window.removeEventListener(UNREAD_EVENT, load) }
  }, [])
  return items
}
