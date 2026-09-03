"use client"

import { useEffect, useRef } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"

const INACTIVITY_MS = 60 * 60 * 1000 // 1 hour
const CHECK_INTERVAL_MS = 30 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 1000
const LAST_ACTIVITY_KEY = "dorix_last_activity"

/**
 * App-wide silent auto-logout after 1 hour of no activity. Mounted once in the root layout.
 *
 * Silent in both directions: no warning before it happens, and no notice afterwards. It lands on
 * the marketing home page rather than /sign-in, because that's where the Sign in button lives —
 * someone coming back after lunch finds their way in from the page they'd expect, instead of being
 * confronted with a login form and an explanation of something they didn't ask about. "/" is
 * locale-aware (middleware redirects it to /de, /fr… from the locale cookie), so they land on the
 * home page in their own language without this file having to know which one that is.
 *
 * Uses a shared localStorage timestamp rather than a per-tab in-memory timer, so activity in one
 * tab keeps every open tab's session alive instead of one idle tab silently signing everyone out.
 */
export function InactivityLogoutWatcher() {
  const { isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const lastWriteRef = useRef(0)

  useEffect(() => {
    if (!isSignedIn) return

    const touch = () => {
      const now = Date.now()
      if (now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return
      lastWriteRef.current = now
      try { window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now)) } catch {}
    }
    touch() // landing here / reloading counts as activity — starts the clock from "now", not undefined

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "scroll", "click", "touchstart", "wheel"]
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))

    const interval = setInterval(() => {
      let last = 0
      try { last = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0) } catch {}
      if (last && Date.now() - last >= INACTIVITY_MS) {
        void signOut({ redirectUrl: "/" })
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      clearInterval(interval)
    }
  }, [isSignedIn, signOut])

  return null
}
