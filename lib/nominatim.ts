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
