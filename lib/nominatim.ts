const HEADERS = {
  "User-Agent": "DORIXE-marketplace/1.0 (contact: antiperhenryotieno@gmail.com)",
  "Accept-Language": "en",
}

export interface GeoResult {
  lat: number
  lng: number
  line1: string
  city: string
  postalCode: string
  country: string
}

export interface PostalValidation {
  valid: boolean
  canonicalCity: string
}

function parseCity(addr: Record<string, string>): string {
  return addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? ""
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error("Nominatim reverse geocode failed")
  const data = await res.json()
  const addr: Record<string, string> = data.address ?? {}

  const road = addr.road ?? addr.street ?? addr.pedestrian ?? ""
  const houseNo = addr.house_number ?? ""
  const line1 = [road, houseNo].filter(Boolean).join(" ").trim()

  return {
    lat,
    lng,
    line1,
    city: parseCity(addr),
    postalCode: addr.postcode ?? "",
    country: (addr.country_code ?? "de").toUpperCase(),
  }
}

// Postal-code shapes across our markets (PL 12-345, PT 1234-567, NL 1234 AB, DE/FR/ES/IT/US 5-digit
// + ZIP+4, generic 4-digit) — pulls a clean postal token out of messy input like "12047 Neukölln".
const POSTAL_PATTERNS = [
  /\b\d{2}-\d{3}\b/,          // PL
  /\b\d{4}-\d{3}\b/,          // PT
  /\b\d{4}\s?[A-Za-z]{2}\b/,  // NL
  /\b\d{5}(?:-\d{4})?\b/,     // DE/FR/ES/IT + US ZIP(+4)
  /\b\d{4}\b/,                // generic 4-digit (AT/DK/…)
]

export function extractPostalCode(raw: string): string {
  const s = (raw ?? "").trim()
  for (const re of POSTAL_PATTERNS) {
    const m = s.match(re)
    if (m) return m[0]
  }
  return s
}

async function searchOnce(params: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&${params}`, { headers: HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// Resilient geocoder for USER-TYPED addresses. Structured postal+city search alone dies on real-world
// input ("12047 Neukölln" in the postal field → zero results → dead end). Ladder:
// 1. structured with the CLEANED postal token, 2. free-form "postal city" (recovers messy input at
// district precision), 3. structured city-only (centroid — good enough for a radius search).
export async function geocodeFlexible(a: { city: string; postalCode: string; country: string }): Promise<{ lat: number; lng: number } | null> {
  const postal = extractPostalCode(a.postalCode)
  const cc = (a.country || "").toLowerCase()
  return (
    (await searchOnce(`postalcode=${encodeURIComponent(postal)}&city=${encodeURIComponent(a.city)}&country=${encodeURIComponent(a.country)}`)) ??
    (await searchOnce(`q=${encodeURIComponent(`${postal} ${a.city}`)}${cc ? `&countrycodes=${cc}` : ""}`)) ??
    (await searchOnce(`city=${encodeURIComponent(a.city)}&country=${encodeURIComponent(a.country)}`))
  )
}

export async function validatePostalCity(
  postalCode: string,
  country: string,
  typedCity: string
): Promise<PostalValidation> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(postalCode)}&country=${encodeURIComponent(country)}&addressdetails=1&limit=1`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return { valid: true, canonicalCity: "" }

  const data = await res.json()
  if (!data[0]?.address) return { valid: true, canonicalCity: "" }

  const canonicalCity = parseCity(data[0].address)
  if (!canonicalCity || !typedCity) return { valid: true, canonicalCity }

  // Fuzzy compare: partial match after stripping diacritics
  const norm = (s: string) =>
    s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")

  const a = norm(canonicalCity)
  const b = norm(typedCity)
  const valid = a.includes(b) || b.includes(a)

  return { valid, canonicalCity }
}
