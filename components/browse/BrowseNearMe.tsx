"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MapPin } from "lucide-react"
import { reverseGeocode } from "@/lib/nominatim"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import type { GeoResult } from "@/lib/nominatim"

type Labels = { detecting: string; nearYou: string }

// Location-first browse: when the page opens with no location, silently try browser geolocation and
// reload the list gated to cleaners who actually SERVE the visitor's coordinates (each cleaner's own
// service radius). Attempted once per session (sessionStorage guard); the manual button always works.
export function BrowseNearMe({
  activeCity, geoActive, labels, otherFilters,
}: {
  activeCity: string | null
  geoActive?: boolean
  labels: Labels
  // Every other active filter (ecoLevel, minRating, minPrice, maxPrice, maxDistanceKm) — carried
  // forward into the location URL so switching into "near me" mode doesn't silently reset them.
  otherFilters?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [detecting, setDetecting] = useState(false)

  function applyLocation(lat: number, lng: number, city: string) {
    const params = new URLSearchParams()
    params.set("lat", lat.toFixed(5))
    params.set("lng", lng.toFixed(5))
    if (city) params.set("city", city)
    for (const [k, v] of Object.entries(otherFilters ?? {})) if (v) params.set(k, v)
    router.replace(`/browse?${params.toString()}`)
  }

  useEffect(() => {
    if (activeCity || geoActive || typeof window === "undefined") return
    if (sessionStorage.getItem("browseGeoTried")) return
    sessionStorage.setItem("browseGeoTried", "1")
    if (!("geolocation" in navigator)) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        let city = ""
        try {
          const r = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          city = r.city ?? ""
        } catch { /* coordinates alone still gate correctly */ }
        applyLocation(pos.coords.latitude, pos.coords.longitude, city)
        setDetecting(false)
      },
      () => setDetecting(false), // denied/unavailable → show the full directory
      { timeout: 8000, maximumAge: 600_000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (detecting) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF5F0] px-3 py-1.5 text-xs font-medium text-[#2D7A5F]">
        <Loader2 size={12} className="animate-spin" /> {labels.detecting}
      </span>
    )
  }
  if (activeCity || geoActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF5F0] px-3 py-1.5 text-xs font-medium text-[#2D7A5F]">
        <MapPin size={12} /> {labels.nearYou.replace("{city}", activeCity ?? "📍")}
      </span>
    )
  }
  return <LocationDetectButton onDetect={(r: GeoResult) => applyLocation(r.lat, r.lng, r.city)} />
}
