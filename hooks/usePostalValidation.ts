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
      const { valid, canonicalCity } = await validatePostalCity(postalCode, country, typedCity)

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
