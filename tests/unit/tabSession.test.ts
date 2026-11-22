import { describe, it, expect, beforeEach } from "vitest"
import {
  INACTIVITY_MS, LAST_ACTIVITY_KEY, TAB_ALIVE_MS, heartbeat, registerTab, shouldSignOutOnOpen,
  unregisterTab, type Store,
} from "@/lib/auth/tabSession"

// Minimal in-memory stand-in for sessionStorage / localStorage.
function memStore(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size },
  }
}

const HOME = new URL("https://dorixe.example/dashboard")
const T0 = 1_800_000_000_000

let shared: ReturnType<typeof memStore>
beforeEach(() => { shared = memStore() })

const open = (tab: Store, now: number, url = HOME, signedIn = true) =>
  shouldSignOutOnOpen({ tab, shared, url, now, signedIn })

describe("sign out when the last tab was closed", () => {
  it("reload of the same tab stays signed in", () => {
    const tab = memStore()
    registerTab(tab, shared, T0)
    expect(open(tab, T0 + 5_000)).toBeNull()
  })

  it("opening a second tab while the first is open stays signed in", () => {
    registerTab(memStore(), shared, T0)
    expect(open(memStore(), T0 + 5_000)).toBeNull()
  })

  it("a background tab whose heartbeat is ~70s old still counts as open", () => {
    registerTab(memStore(), shared, T0)
    expect(open(memStore(), T0 + 70_000)).toBeNull()
  })

  it("closing the last tab then reopening the site signs out", () => {
    const first = memStore()
    const id = registerTab(first, shared, T0)
    unregisterTab(shared, id) // pagehide on close
    expect(open(memStore(), T0 + 1_000)).toBe("tab-closed")
  })

  it("a crashed tab (heartbeat gone stale) does not keep the session alive", () => {
    const id = registerTab(memStore(), shared, T0)
    heartbeat(shared, id, T0 + 10_000)
    expect(open(memStore(), T0 + 10_000 + TAB_ALIVE_MS)).toBe("tab-closed")
  })

  it("never signs out on a Stripe bank-redirect return", () => {
    const url = new URL("https://dorixe.example/book/confirm?status=success&payment_intent=pi_1&redirect_status=succeeded")
    expect(open(memStore(), T0, url)).toBeNull()
    expect(open(memStore(), T0, new URL("https://dorixe.example/x?setup_intent=seti_1"))).toBeNull()
  })

  it("never signs out on sign-in / sign-up pages (incl. Google return)", () => {
    expect(open(memStore(), T0, new URL("https://dorixe.example/sign-in/sso-callback"))).toBeNull()
    expect(open(memStore(), T0, new URL("https://dorixe.example/sign-up"))).toBeNull()
  })

  it("does nothing for a signed-out visitor", () => {
    expect(open(memStore(), T0, HOME, false)).toBeNull()
  })
})

describe("1-hour idle rule judged on open, before activity is stamped", () => {
  it("61 minutes away signs out even in the same tab", () => {
    const tab = memStore()
    registerTab(tab, shared, T0)
    shared.setItem(LAST_ACTIVITY_KEY, String(T0))
    expect(open(tab, T0 + INACTIVITY_MS + 60_000)).toBe("idle")
  })

  it("59 minutes away stays signed in", () => {
    const tab = memStore()
    const id = registerTab(tab, shared, T0)
    shared.setItem(LAST_ACTIVITY_KEY, String(T0))
    heartbeat(shared, id, T0 + INACTIVITY_MS - 60_000)
    expect(open(tab, T0 + INACTIVITY_MS - 60_000)).toBeNull()
  })

  it("a week away — the reported case — signs out", () => {
    shared.setItem(LAST_ACTIVITY_KEY, String(T0))
    expect(open(memStore(), T0 + 7 * 24 * 3600_000)).not.toBeNull()
  })
})

describe("tab list housekeeping", () => {
  it("drops long-dead tabs when a new tab registers", () => {
    registerTab(memStore(), shared, T0)
    registerTab(memStore(), shared, T0 + TAB_ALIVE_MS + 1)
    const tabKeys = [...shared.data.keys()].filter((k) => k.startsWith("dorix_tab:"))
    expect(tabKeys).toHaveLength(1)
  })
})
