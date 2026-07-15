import { redis } from "@/lib/redis/client"

/**
 * ISO-3166 country code for an IP, cached in Redis. Sent to Umami as cf-ipcountry alongside the raw
 * x-forwarded-for. NOTE: self-hosted Umami 3.0.3 IGNORES cf-ipcountry and geolocates x-forwarded-for
 * with its bundled GeoIP db — which only works because the app talks to the Umami container directly
 * (same docker network); through Traefik the XFF gets replaced. The cf-ipcountry header is kept as
 * insurance for setups that do honour it (Cloudflare in front, Umami Cloud).
 */
export async function countryForIp(ip: string | null): Promise<string | null> {
  if (!ip) return null
  const key = `geoip:cc:${ip}`
  try {
    const cached = await redis.get<string>(key)
    if (cached) return cached === "??" ? null : cached
  } catch { /* fall through to lookup */ }

  let cc: string | null = null
  // Primary: ipapi.co over HTTPS. The previous HTTP-only ip-api.com call was unreliable server-side
  // on the VPS (outbound :80 / datacenter-IP blocking), so countryForIp returned null and the
  // /_a proxy never sent cf-ipcountry — leaving Umami (which has no GeoIP DB here) with "Unknown".
  // HTTPS ipapi.co is the provider /api/geo/country already resolves with successfully in prod.
  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      headers: { Accept: "text/plain", "User-Agent": "DORIXE-marketplace/1.0" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    })
    if (res.ok) {
      const text = (await res.text()).trim().toUpperCase()
      if (/^[A-Z]{2}$/.test(text)) cc = text
    }
  } catch { /* try fallback */ }
  // Fallback: ip-api.com over HTTP.
  if (!cc) {
    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, { signal: AbortSignal.timeout(2500), cache: "no-store" })
      if (res.ok) {
        const d = await res.json()
        if (d?.status === "success" && typeof d?.countryCode === "string") cc = d.countryCode.toUpperCase()
      }
    } catch { /* leave null */ }
  }

  // Cache a hit for 7 days; a miss for 1 hour so transient failures retry soon.
  try { await redis.setex(key, cc ? 7 * 86400 : 3600, cc ?? "??") } catch {}
  return cc
}
