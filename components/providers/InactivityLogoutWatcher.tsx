"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import {
  HEARTBEAT_MS, LAST_ACTIVITY_KEY, heartbeat, idleExpired, isExemptLanding, registerTab,
  shouldSignOutOnOpen, unregisterTab,
} from "@/lib/auth/tabSession"

const CHECK_INTERVAL_MS = 30 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 1000

/**
 * App-wide silent auto-logout. Mounted once in the root layout. Two rules (logic and reasons in
 * lib/auth/tabSession.ts):
 *   - 1 hour with no activity in any tab;
 *   - the last open tab of the site was closed — checked when the site is next opened, because a
 *     browser gives no reliable moment to act while a tab is closing.
 *
 * Silent in both directions: no warning, no notice afterwards. It lands on the home page ("/",
 * locale-aware via middleware), where the Sign in button lives. signOut() ends the session at
 * Clerk, not just in this browser.
 */
export function InactivityLogoutWatcher() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const lastWriteRef = useRef(0)
  const openCheckedRef = useRef(false)
  const [tabId, setTabId] = useState<string | null>(null)

  // Once per tab, on the first load after Clerk is ready: decide, then register this tab.
  useEffect(() => {
    if (!isLoaded || openCheckedRef.current) return
    openCheckedRef.current = true
    let tab: Storage, shared: Storage
    try { tab = window.sessionStorage; shared = window.localStorage } catch { return }

    const now = Date.now()
    const url = new URL(window.location.href)
    // Coming back from the bank mid-payment is activity — otherwise the idle check below could
    // still sign them out 30s later if the bank step ran long.
    if (isExemptLanding(url)) { try { shared.setItem(LAST_ACTIVITY_KEY, String(now)) } catch {} }
    const reason = shouldSignOutOnOpen({ tab, shared, url, now, signedIn: !!isSignedIn })
    setTabId(registerTab(tab, shared, now))
    if (reason) {
      // Clear the stale stamp so the next sign-in is not judged idle the moment it lands.
      try { shared.removeItem(LAST_ACTIVITY_KEY) } catch {}
      void signOut({ redirectUrl: "/" })
    }
  }, [isLoaded, isSignedIn, signOut])

  // Keep this tab's "still open" heartbeat going; remove it when the tab closes or navigates away.
  useEffect(() => {
    if (!tabId) return
    const shared = window.localStorage
    const beat = setInterval(() => heartbeat(shared, tabId, Date.now()), HEARTBEAT_MS)
    const onHide = () => unregisterTab(shared, tabId)
    const onShow = () => heartbeat(shared, tabId, Date.now()) // back from the back/forward cache
    window.addEventListener("pagehide", onHide)
    window.addEventListener("pageshow", onShow)
    return () => {
      clearInterval(beat)
      window.removeEventListener("pagehide", onHide)
      window.removeEventListener("pageshow", onShow)
    }
  }, [tabId])

  // Idle rule while the page is open. Declared after the open-time check so a stale timestamp is
  // judged before touch() could overwrite it — and touch() itself never revives an expired one.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const touch = () => {
      const now = Date.now()
      if (now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return
      lastWriteRef.current = now
      try {
        if (idleExpired(window.localStorage, now)) return
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
      } catch {}
    }
    touch()

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "scroll", "click", "touchstart", "wheel"]
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))

    const interval = setInterval(() => {
      let expired = false
      try { expired = idleExpired(window.localStorage, Date.now()) } catch {}
      if (expired) void signOut({ redirectUrl: "/" })
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      clearInterval(interval)
    }
  }, [isLoaded, isSignedIn, signOut])

  return null
}
