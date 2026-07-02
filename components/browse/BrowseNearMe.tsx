"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MapPin } from "lucide-react"
import { reverseGeocode } from "@/lib/nominatim"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import type { GeoResult } from "@/lib/nominatim"

type Labels = { detecting: string; nearYou: string }

// Location-first browse: when the page opens with no city filter, silently try browser geolocation
// and reload the list scoped to the visitor's city. Attempted once per session (sessionStorage guard)
// so clearing the filter doesn't re-trigger it; the manual "use my location" button always works.
export function BrowseNearMe({ activeCity, labels }: { activeCity: string | null; labels: Labels }) {
  const router = useRouter()
  const [detecting, setDetecting] = useState(false)

  function applyCity(city: string) {
    if (city) router.replace(`/browse?city=${encodeURIComponent(city)}`)
  }

  useEffect(() => {
    if (activeCity || typeof window === "undefined") return
    if (sessionStorage.getItem("browseGeoTried")) return
    sessionStorage.setItem("browseGeoTried", "1")
    if (!("geolocation" in navigator)) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          if (r.city) applyCity(r.city)
        } catch { /* keep unfiltered list */ }
        setDetecting(false)
      },
      () => setDetecting(false), // denied/unavailable → show all cleaners
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
  if (activeCity) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF5F0] px-3 py-1.5 text-xs font-medium text-[#2D7A5F]">
        <MapPin size={12} /> {labels.nearYou.replace("{city}", activeCity)}
      </span>
    )
  }
  return <LocationDetectButton onDetect={(r: GeoResult) => applyCity(r.city)} />
}
