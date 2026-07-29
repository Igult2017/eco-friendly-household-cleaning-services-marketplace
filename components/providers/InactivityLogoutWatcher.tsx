"use client"

import { useEffect, useRef } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import { toast } from "sonner"
import { isLocale, defaultLocale, type Locale } from "@/i18n/config"

const INACTIVITY_MS = 60 * 60 * 1000 // 1 hour
const CHECK_INTERVAL_MS = 30 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 1000
const LAST_ACTIVITY_KEY = "dorix_last_activity"
const AUTO_LOGOUT_FLAG_KEY = "dorix_auto_logout"

const MESSAGE: Record<Locale, string> = {
  en: "You were signed out after 1 hour of inactivity.",
  de: "Du wurdest nach 1 Stunde Inaktivität abgemeldet.",
  fr: "Vous avez été déconnecté(e) après 1 heure d'inactivité.",
  es: "Se cerró tu sesión tras 1 hora de inactividad.",
  it: "Sei stato disconnesso dopo 1 ora di inattività.",
  nl: "Je bent uitgelogd na 1 uur inactiviteit.",
  pl: "Zostałeś wylogowany po 1 godzinie bezczynności.",
  pt: "A tua sessão terminou após 1 hora de inatividade.",
}

// Root layout has no NextIntlClientProvider (it's intentionally static — see app/layout.tsx), so
// this reads the same `locale` cookie the server sets instead of using useTranslations.
function currentLocale(): Locale {
  if (typeof document === "undefined") return defaultLocale
  const match = document.cookie.match(/(?:^|; )locale=([^;]+)/)
  const val = match ? decodeURIComponent(match[1]) : null
  return isLocale(val) ? val : defaultLocale
}

/**
 * App-wide silent auto-logout after 1 hour of no activity. Mounted once in the root layout.
 * Silent: no warning before it happens. Deferred: the "you were logged out" notice isn't shown
 * live — a one-shot flag survives the sign-out/redirect in localStorage, and the notice pops up
 * as a toast the next time the app loads (landing on /sign-in). No email, no in-app notification
 * row — purely client-side and ephemeral.
 *
 * Uses a shared localStorage timestamp rather than a per-tab in-memory timer, so activity in one
 * tab keeps every open tab's session alive instead of one idle tab silently signing everyone out.
 */
export function InactivityLogoutWatcher() {
  const { isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const lastWriteRef = useRef(0)

  // Show the deferred notice exactly once, on mount, regardless of sign-in state — this is what
  // fires right after the auto-logout redirect lands on the next page.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(AUTO_LOGOUT_FLAG_KEY)) {
      window.localStorage.removeItem(AUTO_LOGOUT_FLAG_KEY)
      toast.info(MESSAGE[currentLocale()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        try { window.localStorage.setItem(AUTO_LOGOUT_FLAG_KEY, "1") } catch {}
        void signOut({ redirectUrl: "/sign-in" })
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      clearInterval(interval)
    }
  }, [isSignedIn, signOut])

  return null
}
