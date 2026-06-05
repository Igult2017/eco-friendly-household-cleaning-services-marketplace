"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { ProviderCard } from "@/components/booking/ProviderCard"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MapPin, Search } from "lucide-react"
import type { GeoProvider } from "@/lib/db/queries/geo"
import type { Address } from "@/types"

export default function BookStep2Page() {
  const router = useRouter()
  const { setAddress, setProvider, selectedProviderId, categoryId } = useBookingStore()

  const [address, setAddressForm] = useState<Address>({ line1: "", city: "", postalCode: "", country: "DE" })
  const [providers, setProviders] = useState<GeoProvider[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(selectedProviderId)
  const [error, setError] = useState<string | null>(null)
  const latRef = useRef<number | null>(null)
  const lngRef = useRef<number | null>(null)

  const geocodeAndSearch = useCallback(async () => {
    if (!address.postalCode || !address.city) {
      setError("Please enter your city and postal code")
      return
    }
    setSearching(true)
    setError(null)

    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(address.postalCode)}&city=${encodeURIComponent(address.city)}&country=${address.country}&limit=1`
      const geoRes = await fetch(geocodeUrl, { headers: { "Accept-Language": "en" } })
      const geoData = await geoRes.json()

      if (!geoData[0]) {
        setError("Could not locate your address. Please check your postal code.")
        return
      }

      const lat = parseFloat(geoData[0].lat)
      const lng = parseFloat(geoData[0].lon)
      latRef.current = lat
      lngRef.current = lng

      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: "25" })
      if (categoryId) params.set("categoryId", categoryId)

      const res = await fetch(`/api/geo/providers?${params}`)
      const data = await res.json()
      setProviders(data.providers ?? [])
      setSearched(true)
    } catch {
      setError("Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }, [address, categoryId])

  function handleSelectProvider(id: string) {
    setSelectedId(id)
    if (latRef.current && lngRef.current) {
      setAddress(address, latRef.current, lngRef.current)
    }
    setProvider(id)
  }

  function handleNext() {
    if (!selectedId) return
    router.push("/book/schedule")
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <WizardProgress current={2} />

      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] text-center mb-2">
          Where do you need cleaning?
        </h1>
        <p className="text-center text-[#6B7280] mb-8">We'll find eco-verified cleaners near you</p>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">Street address</Label>
              <Input
                value={address.line1}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, line1: e.target.value }))}
                placeholder="e.g. Hauptstraße 42"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">City</Label>
              <Input
                value={address.city}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="e.g. Berlin"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">Postal code</Label>
              <Input
                value={address.postalCode}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                placeholder="e.g. 10115"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">Country</Label>
              <Input value="Germany" disabled className="text-[#6B7280]" />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <Button
            onClick={geocodeAndSearch}
            disabled={searching}
            className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-10"
          >
            {searching ? <><Loader2 size={16} className="animate-spin mr-2" /> Searching...</> : <><Search size={16} className="mr-2" /> Find Cleaners Near Me</>}
          </Button>
        </div>

        {searched && (
          <div className="space-y-3 mb-6">
            {providers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#E5EBF0]">
                <MapPin size={40} className="mx-auto text-[#9CA3AF] mb-3" />
                <p className="text-[#6B7280] font-medium">No providers found in your area yet</p>
                <p className="text-sm text-[#9CA3AF] mt-1">Try expanding your search radius or check back soon</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-[#6B7280]">{providers.length} provider{providers.length !== 1 ? "s" : ""} found nearby</p>
                {providers.map((p) => (
                  <ProviderCard key={p.id} provider={p} onSelect={handleSelectProvider} selected={selectedId === p.id} />
                ))}
              </>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/book")} className="flex-1 h-11 border-[#E5EBF0]">
            ← Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedId}
            className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white"
          >
            Continue — Pick a Time →
          </Button>
        </div>
      </div>
    </div>
  )
}
