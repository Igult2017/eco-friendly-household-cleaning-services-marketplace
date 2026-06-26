const BASE = (process.env.UMAMI_INTERNAL_URL ?? "http://umami:3000").replace(/\/$/, "")
// Self-hosted Umami authenticates via POST /api/auth/login (username + password)
// → JWT, sent as `Authorization: Bearer`. (API keys are a Umami Cloud-only feature.)
const USERNAME = process.env.UMAMI_USERNAME ?? ""
const PASSWORD = process.env.UMAMI_PASSWORD ?? ""
export const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? ""

// Cache the JWT in module scope to avoid logging in on every request.
let cachedToken: { token: string; expires: number } | null = null

async function getToken(forceRefresh = false): Promise<string | null> {
  if (!USERNAME || !PASSWORD) return null
  if (!forceRefresh && cachedToken && cachedToken.expires > Date.now()) return cachedToken.token
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    if (!data.token) return null
    cachedToken = { token: data.token, expires: Date.now() + 60 * 60 * 1000 } // 1h
    return data.token
  } catch {
    return null
  }
}

export type UmamiMetric = { x: string; y: number }
export type UmamiStats = {
  pageviews: { value: number; prev: number }
  visitors: { value: number; prev: number }
  visits: { value: number; prev: number }
  bounces: { value: number; prev: number }
  totaltime: { value: number; prev: number }
}
export type UmamiPageviews = {
  pageviews: Array<{ x: string; y: number }>
  sessions: Array<{ x: string; y: number }>
}

async function umamiGet<T>(path: string): Promise<T | null> {
  if (!WEBSITE_ID) return null
  let token = await getToken()
  if (!token) return null
  try {
    let res = await fetch(`${BASE}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })
    // Token expired/invalid → log in again once and retry.
    if (res.status === 401 || res.status === 403) {
      token = await getToken(true)
      if (!token) return null
      res = await fetch(`${BASE}/api${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      })
    }
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

const DAYS = 30

// Umami's /stats shape varies by version: older returns { pageviews: {value,prev} },
// newer returns flat { pageviews: 8, ..., comparison: { pageviews: 0 } }. Normalize
// both into the { value, prev } shape the dashboard renders.
function normalizeStats(raw: Record<string, unknown> | null): UmamiStats | null {
  if (!raw) return null
  const cmp = (raw.comparison ?? {}) as Record<string, unknown>
  const metric = (key: string) => {
    const cur = raw[key]
    if (cur && typeof cur === "object") {
      const o = cur as { value?: number; prev?: number }
      return { value: o.value ?? 0, prev: o.prev ?? 0 }
    }
    const prevRaw = cmp[key]
    const prev = prevRaw && typeof prevRaw === "object" ? ((prevRaw as { value?: number }).value ?? 0) : Number(prevRaw ?? 0)
    return { value: Number(cur ?? 0), prev }
  }
  return {
    pageviews: metric("pageviews"),
    visitors: metric("visitors"),
    visits: metric("visits"),
    bounces: metric("bounces"),
    totaltime: metric("totaltime"),
  }
}

export async function getAnalytics() {
  const end = Date.now()
  const start = end - DAYS * 24 * 60 * 60 * 1000
  const qs = `startAt=${start}&endAt=${end}`
  const [statsRaw, countries, referrers, pages, pageviews] = await Promise.all([
    umamiGet<Record<string, unknown>>(`/websites/${WEBSITE_ID}/stats?${qs}`),
    umamiGet<UmamiMetric[]>(`/websites/${WEBSITE_ID}/metrics?type=country&${qs}&limit=20`),
    umamiGet<UmamiMetric[]>(`/websites/${WEBSITE_ID}/metrics?type=referrer&${qs}&limit=100`),
    umamiGet<UmamiMetric[]>(`/websites/${WEBSITE_ID}/metrics?type=url&${qs}&limit=20`),
    umamiGet<UmamiPageviews>(`/websites/${WEBSITE_ID}/pageviews?${qs}&unit=day&timezone=Europe%2FBerlin`),
  ])
  return {
    configured: !!(USERNAME && PASSWORD && WEBSITE_ID),
    stats: normalizeStats(statsRaw),
    countries,
    referrers,
    pages,
    pageviews,
  }
}

// Social media domain → platform name
const SOCIAL_MAP: Record<string, string> = {
  "t.co": "Twitter / X",
  "twitter.com": "Twitter / X",
  "x.com": "Twitter / X",
  "l.facebook.com": "Facebook",
  "facebook.com": "Facebook",
  "m.facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "l.instagram.com": "Instagram",
  "linkedin.com": "LinkedIn",
  "lnkd.in": "LinkedIn",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "pinterest.com": "Pinterest",
  "tiktok.com": "TikTok",
  "reddit.com": "Reddit",
  "whatsapp.com": "WhatsApp",
  "telegram.org": "Telegram",
  "t.me": "Telegram",
}

// Sign-in/sign-up redirects (OAuth + Clerk) and self/internal hosts are NOT real referrers — they're
// just how a visitor authenticated. Drop them so the panel shows genuine external traffic sources.
function isNoiseReferrer(domain: string): boolean {
  if (!domain) return false
  const ownHost = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/^https?:\/\//, "").split("/")[0].toLowerCase()
  if (ownHost && domain === ownHost) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return true        // bare IP = server self-referral
  if (domain === "localhost" || domain === "0.0.0.0") return true
  return /accounts\.google\.|\.clerk\.accounts\.dev$|^clerk\.|\.clerk\.com$|accounts\.youtube\.|appleid\.apple\.com|login\.(live|microsoftonline)\.com/i.test(domain)
}

/** Roll raw referrer URLs into social platform names + an "Other / Direct" bucket. */
export function classifyReferrers(metrics: UmamiMetric[]) {
  const map = new Map<string, number>()
  for (const { x: raw, y } of metrics) {
    const domain = (raw ?? "").replace(/^https?:\/\//, "").split("/")[0].toLowerCase()
    if (isNoiseReferrer(domain)) continue
    const label = SOCIAL_MAP[domain] ?? (domain ? `Other (${domain.slice(0, 30)})` : "Direct")
    map.set(label, (map.get(label) ?? 0) + y)
  }
  return Array.from(map.entries())
    .map(([name, visits]) => ({ name, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10)
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Aggregate a Umami daily pageview series into day-of-week totals. */
export function computeDayOfWeek(series: Array<{ x: string; y: number }>) {
  const totals = Array(7).fill(0) as number[]
  for (const { x, y } of series) {
    const dow = new Date(x).getDay()
    totals[dow] += y
  }
  return DOW_LABELS.map((name, i) => ({ name, views: totals[i] }))
}

/** Map ISO 3166-1 alpha-2 code to human-readable country name (Node Intl). */
export function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
