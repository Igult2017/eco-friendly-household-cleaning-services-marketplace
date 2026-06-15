import { NextResponse } from "next/server"

export const runtime = "nodejs"

const NULL_RESULT = { country: null, countryCode: null }

type GeoResult = {
  country: string | null
  countryCode: string | null
  city?: string | null
  region?: string | null
  continentCode?: string | null
  currency?: string
  timezone?: string
}

// The visitor's real IP, from the proxy's forwarded headers. Without this we'd
// geolocate the server, not the visitor.
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const ip = xff.split(",")[0].trim()
    if (ip && !ip.startsWith("0.") && ip !== "127.0.0.1" && ip !== "::1") return ip
  }
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null
}

// Primary: ipapi.co (HTTPS, no key for low volume).
async function viaIpapiCo(ip: string | null): Promise<GeoResult | null> {
  const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/"
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "DORIXE-marketplace/1.0" },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const d = await res.json()
  if (d?.error || !d?.country_code) return null
  return {
    country: d.country_name ?? null,
    countryCode: d.country_code ?? null,
    city: d.city ?? null,
    region: d.region ?? null,
    continentCode: d.continent_code ?? null,
    currency: d.currency ?? "EUR",
    timezone: d.timezone ?? "UTC",
  }
}

// Fallback: ip-api.com (HTTP only on the free tier; fine server-side).
async function viaIpApiCom(ip: string | null): Promise<GeoResult | null> {
  const fields = "status,country,countryCode,city,regionName,timezone,currency,continentCode"
  const url = `http://ip-api.com/json/${ip ?? ""}?fields=${fields}`
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } })
  if (!res.ok) return null
  const d = await res.json()
  if (d?.status !== "success" || !d?.countryCode) return null
  return {
    country: d.country ?? null,
    countryCode: d.countryCode ?? null,
    city: d.city ?? null,
    region: d.regionName ?? null,
    continentCode: d.continentCode ?? null,
    currency: d.currency ?? "EUR",
    timezone: d.timezone ?? "UTC",
  }
}

export async function GET(req: Request) {
  const ip = clientIp(req)
  for (const provider of [viaIpapiCo, viaIpApiCom]) {
    try {
      const result = await provider(ip)
      if (result?.countryCode) return NextResponse.json(result)
    } catch {
      // try the next provider
    }
  }
  // Never block rendering — callers treat null as "use Accept-Language / default".
  return NextResponse.json(NULL_RESULT, { status: 200 })
}
