"use client"

import { useEffect, useState } from "react"
import { SUPPORTED_COUNTRIES } from "@/lib/utils/countries"

const norm = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")

// Exact resolution — full country name or 2-letter code ("germany" / "de" → DE).
function matchExact(input: string): [string, string] | null {
  const q = norm(input)
  if (!q) return null
  if (q.length === 2) {
    const byCode = SUPPORTED_COUNTRIES.find(([c]) => c.toLowerCase() === q)
    if (byCode) return byCode
  }
  return SUPPORTED_COUNTRIES.find(([, n]) => norm(n) === q) ?? null
}

// Forgiving resolution for blur — unique prefix counts ("neth" → Netherlands).
function matchFuzzy(input: string): [string, string] | null {
  const exact = matchExact(input)
  if (exact) return exact
  const q = norm(input)
  if (!q) return null
  const prefix = SUPPORTED_COUNTRIES.filter(([, n]) => norm(n).startsWith(q))
  return prefix.length === 1 ? prefix[0] : null
}

// Country input that allows MANUAL TYPING (with native datalist suggestions) but always resolves to a
// supported ISO code — the booking APIs validate a 2-char code and currency/units are derived from it,
// so arbitrary free text can never be submitted.
export function CountryField({ code, onCode, invalidText, id = "country" }: {
  code: string
  onCode: (code: string) => void
  invalidText: string
  id?: string
}) {
  const nameFor = (c: string) => SUPPORTED_COUNTRIES.find(([cc]) => cc === c)?.[1] ?? c
  const [text, setText] = useState(nameFor(code))
  const [invalid, setInvalid] = useState(false)

  // Parent changed the code (e.g. "Use my location") → sync the display text.
  useEffect(() => { setText(nameFor(code)); setInvalid(false) }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(v: string) {
    setText(v)
    setInvalid(false)
    const m = matchExact(v) // full name typed or picked from the suggestion list → commit immediately
    if (m && m[0] !== code) onCode(m[0])
  }

  function handleBlur() {
    const m = matchFuzzy(text)
    if (m) { setText(m[1]); setInvalid(false); if (m[0] !== code) onCode(m[0]) }
    else if (!text.trim()) { setText(nameFor(code)); setInvalid(false) }
    else setInvalid(true)
  }

  return (
    <div>
      <input
        list={`${id}-list`}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        autoComplete="off"
        aria-invalid={invalid}
        className="flex h-10 w-full rounded-md border border-[#E5EBF0] bg-white px-3 py-2 text-sm text-[#2B3441] focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
      />
      <datalist id={`${id}-list`}>
        {SUPPORTED_COUNTRIES.map(([c, n]) => <option key={c} value={n}>{c}</option>)}
      </datalist>
      {invalid && <p className="mt-1 text-xs text-red-500">{invalidText}</p>}
    </div>
  )
}
