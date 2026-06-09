const BASE = process.env.UMAMI_INTERNAL_URL ?? "http://umami:3000"
const API_KEY = process.env.UMAMI_API_KEY ?? ""
export const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? ""

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
  if (!API_KEY || !WEBSITE_ID) return null
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: { "x-umami-api-key": API_KEY },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

const DAYS = 30

export async function getAnalytics() {
  const end = Date.now()
  const start = end - DAYS * 24 * 60 * 60 * 1000
  const qs = `startAt=${start}&endAt=${end}`
  const [stats, countries, referrers, pages, pageviews] = await Promise.all([
    umamiGet<UmamiStats>(`/websites/${WEBSITE_ID}/stats?${qs}`),
    umamiGet<UmamiMetric[]>(`/websites/${WEBSITE_ID}/metrics?type=country&${qs}&limit=20`),
    umamiGet<UmamiMetric[]>(`/websites/${WEBSITE_ID}/metrics?type=referrer&${qs}&limit=100`),
    umamiGet<UmamiMetric[]>(`/websites/${WEBSITE_ID}/metrics?type=url&${qs}&limit=20`),
    umamiGet<UmamiPageviews>(`/websites/${WEBSITE_ID}/pageviews?${qs}&unit=day&timezone=Europe%2FBerlin`),
  ])
  return {
    configured: !!(API_KEY && WEBSITE_ID),
    stats,
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

/** Roll raw referrer URLs into social platform names + an "Other / Direct" bucket. */
export function classifyReferrers(metrics: UmamiMetric[]) {
  const map = new Map<string, number>()
  for (const { x: raw, y } of metrics) {
    const domain = (raw ?? "").replace(/^https?:\/\//, "").split("/")[0].toLowerCase()
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
