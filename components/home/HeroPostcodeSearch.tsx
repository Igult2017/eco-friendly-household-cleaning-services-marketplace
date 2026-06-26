"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  placeholder: string
  buttonLabel: string
  checkingLabel: string
  availableTemplate: string // contains "{count}"
  noneLabel: string
  viewLabel: string
}

type Result = { count: number } | "none" | null

// Step 1: enter a postcode to check whether cleaners are available in your area.
// Geocodes the postcode, then queries the geo provider search (radius 25km).
export function HeroPostcodeSearch({
  placeholder,
  buttonLabel,
  checkingLabel,
  availableTemplate,
  noneLabel,
  viewLabel,
}: Props) {
  const router = useRouter()
  const [postcode, setPostcode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result>(null)

  async function search() {
    const q = postcode.trim()
    if (!q || loading) return
    setLoading(true)
    setResult(null)
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(q)}&limit=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "DORIXE-marketplace/1.0 (contact: antiperhenryotieno@gmail.com)" } },
      )
      const geo = await geoRes.json()
      if (!geo[0]) {
        setResult("none")
        return
      }
      const lat = parseFloat(geo[0].lat)
      const lng = parseFloat(geo[0].lon)
      const res = await fetch(`/api/geo/providers?lat=${lat}&lng=${lng}&radius=25`)
      const data = await res.json()
      const count = Array.isArray(data.providers) ? data.providers.length : 0
      setResult(count > 0 ? { count } : "none")
    } catch {
      setResult("none")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-8 max-w-md">
      <div className="flex gap-2">
        <label className="flex-1 min-w-0 flex items-center gap-2 bg-white border border-[#E5EDE9] rounded-xl px-4 py-3 shadow-sm focus-within:border-[#2D7A5F] transition-colors">
          <MapPin className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search() }}
            placeholder={placeholder}
            className="flex-1 text-sm outline-none text-[#2B3441] placeholder:text-[#9ca3af] bg-transparent"
          />
        </label>
        <Button
          onClick={search}
          disabled={loading}
          className="bg-[#2D7A5F] hover:bg-[#235f49] text-white rounded-xl px-5 h-full whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonLabel}
        </Button>
      </div>

      {loading && <p className="mt-3 text-sm text-[#6B7280]">{checkingLabel}</p>}

      {result && result !== "none" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-[#2D7A5F]">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{availableTemplate.replace("{count}", String(result.count))}</span>
          <button onClick={() => router.push("/browse")} className="underline font-semibold hover:text-[#235f49]">
            {viewLabel}
          </button>
        </div>
      )}

      {result === "none" && <p className="mt-3 text-sm text-[#6B7280]">{noneLabel}</p>}
    </div>
  )
}
