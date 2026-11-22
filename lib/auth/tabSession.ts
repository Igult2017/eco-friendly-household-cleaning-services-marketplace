// Decides whether opening a page should sign the user out. Pure logic — the browser's two storages
// are passed in, so it is testable without a browser.
//
// Two rules:
//   1. Idle: no activity for 1 hour. Checked on open BEFORE activity is stamped — stamping first
//      erased the evidence of a week away, which is how "closed the tab, still signed in a week
//      later" got through.
//   2. Last tab closed: a fresh tab (no per-tab mark) opening while no other tab of the site is
//      alive means the previous visit ended — sign out. Per-tab storage (sessionStorage) survives a
//      reload and dies with the tab; shared storage (localStorage) holds one heartbeat key per open
//      tab, removed on pagehide.

export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">

export const INACTIVITY_MS = 60 * 60 * 1000
export const HEARTBEAT_MS = 10 * 1000
// Chrome slows timers in background tabs to about once a minute, so an open-but-hidden tab's
// heartbeat can be ~70s old. Anything shorter would sign people out when they open a second tab.
export const TAB_ALIVE_MS = 2 * 60 * 1000

export const LAST_ACTIVITY_KEY = "dorix_last_activity"
const TAB_ID_KEY = "dorix_tab_id"
const TAB_PREFIX = "dorix_tab:"

export type SignOutReason = "idle" | "tab-closed" | null

/** Landings that must never sign out: mid-sign-in, or returning from a bank/3-D Secure redirect. */
export function isExemptLanding(url: URL): boolean {
  if (/^\/(sign-in|sign-up)(\/|$)/.test(url.pathname)) return true
  const p = url.searchParams
  return p.has("payment_intent") || p.has("setup_intent") || p.has("redirect_status")
}

export function idleExpired(shared: Store, now: number): boolean {
  const last = Number(safeGet(shared, LAST_ACTIVITY_KEY) ?? 0)
  return last > 0 && now - last >= INACTIVITY_MS
}

function otherTabAlive(shared: Store, ownId: string | null, now: number): boolean {
  for (let i = 0; i < shared.length; i++) {
    const k = shared.key(i)
    if (!k || !k.startsWith(TAB_PREFIX) || k === TAB_PREFIX + ownId) continue
    const beat = Number(safeGet(shared, k) ?? 0)
    if (now - beat < TAB_ALIVE_MS) return true
  }
  return false
}

/** Called once per tab, on its first load, after Clerk knows whether the user is signed in. */
export function shouldSignOutOnOpen(opts: {
  tab: Store; shared: Store; url: URL; now: number; signedIn: boolean
}): SignOutReason {
  const { tab, shared, url, now, signedIn } = opts
  if (!signedIn || isExemptLanding(url)) return null
  if (idleExpired(shared, now)) return "idle"
  if (safeGet(tab, TAB_ID_KEY)) return null // reload, or same tab coming back
  return otherTabAlive(shared, null, now) ? null : "tab-closed"
}

/** Marks this tab as seen and records its heartbeat. Returns the tab id. */
export function registerTab(tab: Store, shared: Store, now: number): string {
  let id = safeGet(tab, TAB_ID_KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2) + now.toString(36)
    safeSet(tab, TAB_ID_KEY, id)
  }
  safeSet(shared, TAB_PREFIX + id, String(now))
  pruneDeadTabs(shared, now)
  return id
}

export function heartbeat(shared: Store, id: string, now: number) {
  safeSet(shared, TAB_PREFIX + id, String(now))
}

export function unregisterTab(shared: Store, id: string) {
  try { shared.removeItem(TAB_PREFIX + id) } catch {}
}

/** Crashed tabs never remove their key; drop ones long dead so the list does not grow forever. */
function pruneDeadTabs(shared: Store, now: number) {
  const dead: string[] = []
  for (let i = 0; i < shared.length; i++) {
    const k = shared.key(i)
    if (k?.startsWith(TAB_PREFIX) && now - Number(safeGet(shared, k) ?? 0) >= TAB_ALIVE_MS) dead.push(k)
  }
  dead.forEach((k) => { try { shared.removeItem(k) } catch {} })
}

function safeGet(s: Store, k: string): string | null {
  try { return s.getItem(k) } catch { return null }
}
function safeSet(s: Store, k: string, v: string) {
  try { s.setItem(k, v) } catch {}
}
