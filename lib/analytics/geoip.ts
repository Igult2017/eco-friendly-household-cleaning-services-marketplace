import { redis } from "@/lib/redis/client"

/**
 * ISO-3166 country code for an IP, cached in Redis. We resolve the country ourselves and hand it to
 * Umami (via the cf-ipcountry header it honours) so country analytics work regardless of whether the
 * Umami container ships a GeoIP database. Returns null when undeterminable (Umami then falls back).
 */
export async function countryForIp(ip: string | null): Promise<string | null> {
  if (!ip) return null
  const key = `geoip:cc:${ip}`
  try {
    const cached = await redis.get<string>(key)
    if (cached) return cached === "??" ? null : cached
  } catch { /* fall through to lookup */ }

  let cc: string | null = null
  try {
    // ip-api.com: HTTP, no key, returns ISO country code (same provider as /api/geo/country).
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    })
    if (res.ok) {
      const d = await res.json()
      if (d?.status === "success" && typeof d?.countryCode === "string") cc = d.countryCode
    }
  } catch { /* leave null */ }

  // Cache a hit for 7 days; a miss for 1 hour so transient failures retry soon.
  try { await redis.setex(key, cc ? 7 * 86400 : 3600, cc ?? "??") } catch {}
  return cc
}
