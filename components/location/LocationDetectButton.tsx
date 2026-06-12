"use client"

import { MapPin, Loader2, CheckCircle2 } from "lucide-react"
import { useGeolocation } from "@/hooks/useGeolocation"
import type { GeoResult } from "@/lib/nominatim"

interface Props {
  onDetect: (result: GeoResult) => void
  className?: string
}

export function LocationDetectButton({ onDetect, className }: Props) {
  const { detect, loading, error, result } = useGeolocation()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => detect(onDetect)}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2D7A5F]/30 bg-[#F4FAF6] text-xs font-semibold text-[#2D7A5F] hover:bg-[#EDF5F0] active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin shrink-0" />
        ) : result ? (
          <CheckCircle2 size={13} className="shrink-0" />
        ) : (
          <MapPin size={13} className="shrink-0" />
        )}
        {loading ? "Detecting location…" : result ? "Location detected ✓" : "Use my location"}
      </button>

      {error && (
        <p className="mt-1.5 text-xs text-amber-700 leading-snug">{error}</p>
      )}
    </div>
  )
}
