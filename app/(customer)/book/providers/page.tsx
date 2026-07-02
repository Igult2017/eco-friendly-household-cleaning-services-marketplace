"use client"

import { WizardProgress } from "@/components/booking/WizardProgress"
import { ProviderCard } from "@/components/booking/ProviderCard"
import { useBookingStore } from "@/stores/bookingStore"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MapPin, Search, UserCheck } from "lucide-react"
import type { GeoProvider } from "@/lib/db/queries/geo"
import type { Address } from "@/types"
import { LocationDetectButton } from "@/components/location/LocationDetectButton"
import type { GeoResult } from "@/lib/nominatim"
import { geocodeFlexible, extractPostalCode } from "@/lib/nominatim"
import { CountryField } from "@/components/location/CountryField"

export default function BookStep2Page() {
  const t = useTranslations("customerBookProvidersPage")
  const router = useRouter()
  const { setAddress, setProvider, selectedProviderId, categoryId, providerPreselected, providerName, providerCountry, clearPreselection } = useBookingStore()

  // Cleaner chosen BEFORE the wizard (browse/profile Book) → this step collects only the address and
  // goes straight to scheduling; the search + re-pick UI is skipped entirely.
  const preselected = providerPreselected && !!selectedProviderId

  const [address, setAddressForm] = useState<Address>({ line1: "", city: "", postalCode: "", country: providerCountry || "DE" })
  const [providers, setProviders] = useState<GeoProvider[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(selectedProviderId)
  const [error, setError] = useState<string | null>(null)
  const latRef = useRef<number | null>(null)
  const lngRef = useRef<number | null>(null)

  async function searchProviders(lat: number, lng: number) {
    setSearching(true)
    setError(null)
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: "25" })
      if (categoryId) params.set("categoryId", categoryId)
      const res = await fetch(`/api/geo/providers?${params}`)
      const data = await res.json()
      setProviders(data.providers ?? [])
      setSearched(true)
    } catch {
      setError(t("errorSearchFailed"))
    } finally {
      setSearching(false)
    }
  }

  function handleDetect(result: GeoResult) {
    setAddressForm({ line1: result.line1, city: result.city, postalCode: result.postalCode, country: result.country || "DE" })
    latRef.current = result.lat
    lngRef.current = result.lng
    if (!preselected) searchProviders(result.lat, result.lng)
  }

  // Preselected flow: geocode the typed address (if "Use my location" wasn't used) → save → schedule.
  async function handlePreselectedContinue() {
    if (!address.postalCode || !address.city) {
      setError(t("errorMissingCityPostal"))
      return
    }
    setSearching(true)
    setError(null)
    try {
      // Normalize the postal ("12047 Neukölln" → "12047") — the booking API caps postal at 10 chars.
      const cleanAddr = { ...address, postalCode: extractPostalCode(address.postalCode) }
      let lat = latRef.current
      let lng = lngRef.current
      if (lat == null || lng == null) {
        const geo = await geocodeFlexible(cleanAddr)
        if (!geo) { setError(t("errorAddressNotFound")); return }
        lat = geo.lat
        lng = geo.lng
      }
      setAddressForm(cleanAddr)
      setAddress(cleanAddr, lat, lng)
      router.push("/book/schedule")
    } catch {
      setError(t("errorSearchFailed"))
    } finally {
      setSearching(false)
    }
  }

  const geocodeAndSearch = useCallback(async () => {
    if (!address.postalCode || !address.city) {
      setError(t("errorMissingCityPostal"))
      return
    }
    setSearching(true)
    setError(null)

    try {
      // Normalize the postal ("12047 Neukölln" → "12047") — the booking API caps postal at 10 chars.
      const cleanAddr = { ...address, postalCode: extractPostalCode(address.postalCode) }
      const geo = await geocodeFlexible(cleanAddr)
      if (!geo) {
        setError(t("errorAddressNotFound"))
        return
      }
      setAddressForm(cleanAddr)
      latRef.current = geo.lat
      lngRef.current = geo.lng

      const params = new URLSearchParams({ lat: String(geo.lat), lng: String(geo.lng), radius: "25" })
      if (categoryId) params.set("categoryId", categoryId)

      const res = await fetch(`/api/geo/providers?${params}`)
      const data = await res.json()
      setProviders(data.providers ?? [])
      setSearched(true)
    } catch {
      setError(t("errorSearchFailed"))
    } finally {
      setSearching(false)
    }
  }, [address, categoryId, t])

  function handleSelectProvider(id: string) {
    setSelectedId(id)
    if (latRef.current && lngRef.current) {
      setAddress(address, latRef.current, lngRef.current)
    }
    const picked = providers.find((p) => p.id === id)
    setProvider(id, picked?.country ?? null)
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
          {preselected && providerName ? t("preHeading", { name: providerName }) : t("heading")}
        </h1>
        <p className="text-center text-[#6B7280] mb-8">{preselected ? t("preSubheading") : t("subheading")}</p>

        {preselected && providerName && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#2D7A5F]/25 bg-[#EDF5F0] px-4 py-3">
            <UserCheck size={18} className="shrink-0 text-[#2D7A5F]" />
            <p className="flex-1 text-sm font-semibold text-[#2B3441]">{t("preBadge", { name: providerName })}</p>
            <button
              type="button"
              onClick={() => { clearPreselection(); setSelectedId(null) }}
              className="shrink-0 text-xs font-medium text-[#6B7280] hover:text-[#2B3441] transition-colors"
            >
              {t("changeCleaner")}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
          <div className="flex justify-end mb-3">
            <LocationDetectButton onDetect={handleDetect} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("labelStreetAddress")}</Label>
              <Input
                value={address.line1}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, line1: e.target.value }))}
                placeholder={t("placeholderStreetAddress")}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("labelCity")}</Label>
              <Input
                value={address.city}
                onChange={(e) => { setAddressForm((prev) => ({ ...prev, city: e.target.value })); latRef.current = null; lngRef.current = null }}
                placeholder={t("placeholderCity")}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("labelPostalCode")}</Label>
              {/* Editing after "Use my location" must invalidate the detected coords, or the
                  preselected-continue path saves the OLD spot for the new address. */}
              <Input
                value={address.postalCode}
                onChange={(e) => { setAddressForm((prev) => ({ ...prev, postalCode: e.target.value })); latRef.current = null; lngRef.current = null }}
                placeholder={t("placeholderPostalCode")}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">{t("labelCountry")}</Label>
              <CountryField
                id="book-country"
                code={address.country}
                onCode={(c) => setAddressForm((prev) => ({ ...prev, country: c }))}
                invalidText={t("countryInvalid")}
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {!preselected && (
            <Button
              onClick={geocodeAndSearch}
              disabled={searching}
              className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-10"
            >
              {searching ? <><Loader2 size={16} className="animate-spin mr-2" /> {t("searching")}</> : <><Search size={16} className="mr-2" /> {t("findCleanersButton")}</>}
            </Button>
          )}
        </div>

        {!preselected && searched && (
          <div className="space-y-3 mb-6">
            {providers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#E5EBF0]">
                <MapPin size={40} className="mx-auto text-[#9CA3AF] mb-3" />
                <p className="text-[#6B7280] font-medium">{t("emptyTitle")}</p>
                <p className="text-sm text-[#9CA3AF] mt-1">{t("emptySubtitle")}</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-[#6B7280]">{t("providersFound", { count: providers.length })}</p>
                {providers.map((p) => (
                  <ProviderCard key={p.id} provider={p} onSelect={handleSelectProvider} selected={selectedId === p.id} />
                ))}
              </>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/book")} className="flex-1 h-11 border-[#E5EBF0]">
            {t("backButton")}
          </Button>
          {preselected ? (
            <Button
              onClick={handlePreselectedContinue}
              disabled={searching || !address.city || !address.postalCode}
              className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : t("continueButton")}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!selectedId}
              className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white"
            >
              {t("continueButton")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
