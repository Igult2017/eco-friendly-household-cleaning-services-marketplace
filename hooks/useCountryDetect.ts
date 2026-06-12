"use client"

import { useEffect, useState } from "react"

export interface CountryInfo {
  country: string | null
  countryCode: string | null
  currency: string | null
  timezone: string | null
}

const CACHE_KEY = "dorix_geo_country"

export function useCountryDetect(): CountryInfo | null {
  const [info, setInfo] = useState<CountryInfo | null>(null)

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        setInfo(JSON.parse(cached))
        return
      } catch {
        sessionStorage.removeItem(CACHE_KEY)
      }
    }

    fetch("/api/geo/country")
      .then((r) => r.json())
      .then((data: CountryInfo) => {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
        setInfo(data)
      })
      .catch(() => setInfo({ country: null, countryCode: null, currency: null, timezone: null }))
  }, [])

  return info
}
