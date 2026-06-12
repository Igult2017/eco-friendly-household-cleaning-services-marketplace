"use client"

import { useState } from "react"
import { reverseGeocode, type GeoResult } from "@/lib/nominatim"

interface State {
  loading: boolean
  error: string | null
  result: GeoResult | null
}

export function useGeolocation() {
  const [state, setState] = useState<State>({ loading: false, error: null, result: null })

  function detect(onDetect?: (r: GeoResult) => void) {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: "Geolocation is not supported by your browser." }))
      return
    }

    setState({ loading: true, error: null, result: null })

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const result = await reverseGeocode(
            position.coords.latitude,
            position.coords.longitude
          )
          setState({ loading: false, error: null, result })
          onDetect?.(result)
        } catch {
          setState({ loading: false, result: null, error: "Could not resolve your address. Enter it manually." })
        }
      },
      err => {
        const msg =
          err.code === 1
            ? "Location access denied. Allow access in your browser settings."
            : "Could not detect location. Enter your address manually."
        setState({ loading: false, result: null, error: msg })
      },
      { timeout: 10_000, maximumAge: 60_000 }
    )
  }

  return { ...state, detect }
}
