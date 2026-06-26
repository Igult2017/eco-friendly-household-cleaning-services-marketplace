import { getClientIp } from "@/lib/utils/ip"
import { countryForIp } from "@/lib/analytics/geoip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UMAMI = (process.env.UMAMI_INTERNAL_URL ?? "http://umami:3000").replace(/\/$/, "")

/**
 * Umami event-collection proxy. The plain next.config rewrite forwards this POST from inside the app
 * container, so Umami geolocates the *internal Docker IP* and every visit lands under an unknown
 * country. Here we pull the visitor's REAL IP from the edge proxy's forwarded headers and pass it to
 * Umami explicitly (x-forwarded-for + x-real-ip), so its bundled GeoIP can resolve the country.
 * (script.js + other Umami paths keep using the next.config rewrite.)
 */
export async function POST(req: Request) {
  const body = await req.text()
  const ip = getClientIp(req)

  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
    "user-agent": req.headers.get("user-agent") ?? "",
  }
  // Umami reads the visitor IP from these to look up the region/city.
  if (ip) {
    headers["x-forwarded-for"] = ip
    headers["x-real-ip"] = ip
    // Resolve the country ourselves (cached) and hand it to Umami via the header it honours, so
    // country stats don't depend on the Umami container shipping a GeoIP database.
    const cc = await countryForIp(ip)
    if (cc) headers["cf-ipcountry"] = cc
  }
  const lang = req.headers.get("accept-language")
  if (lang) headers["accept-language"] = lang

  try {
    const res = await fetch(`${UMAMI}/api/send`, { method: "POST", headers, body, cache: "no-store" })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "text/plain" },
    })
  } catch {
    // Analytics must never surface an error to the visitor.
    return new Response("", { status: 204 })
  }
}
