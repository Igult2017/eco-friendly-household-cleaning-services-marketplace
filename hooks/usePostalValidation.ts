"use client"

import { useState } from "react"
import { validatePostalCity } from "@/lib/nominatim"

interface PostalState {
  postalError: string | null
  canonicalCity: string | null
  validating: boolean
}

export function usePostalValidation() {
  const [state, setState] = useState<PostalState>({
    postalError: null,
    canonicalCity: null,
    validating: false,
  })

  async function validate(
    postalCode: string,
    country: string,
    typedCity: string
  ): Promise<boolean> {
    if (!postalCode || postalCode.length < 3 || !country) return true
    setState(s => ({ ...s, validating: true }))

    try {
      const { valid, canonicalCity, countryMismatch } = await validatePostalCity(postalCode, country, typedCity)

      // Strongest signal available that the wrong country was picked — surfaced as a visible
      // warning (matching the city-mismatch message below), never a submit-blocker: `valid` stays
      // true here since Nominatim's coverage is incomplete, not proof the address is wrong.
      if (countryMismatch) {
        setState({
          postalError: `We couldn't find postal code "${postalCode}" in the country you selected — double-check you picked the right one.`,
          canonicalCity: null,
          validating: false,
        })
        return true
      }

      if (!valid && canonicalCity) {
        const msg = typedCity
          ? `"${postalCode}" belongs to ${canonicalCity}, not "${typedCity}".`
          : `"${postalCode}" is in ${canonicalCity}.`
        setState({ postalError: msg, canonicalCity, validating: false })
        return false
      }

      setState({ postalError: null, canonicalCity: canonicalCity || null, validating: false })
      return true
    } catch {
      // Nominatim unreachable — don't block submission
      setState({ postalError: null, canonicalCity: null, validating: false })
      return true
    }
  }

  function clear() {
    setState({ postalError: null, canonicalCity: null, validating: false })
  }

  return { ...state, validate, clear }
}
