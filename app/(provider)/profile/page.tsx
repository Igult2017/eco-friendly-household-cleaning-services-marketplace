"use client"

import { useState, useEffect } from "react"
import { Loader2, Save } from "lucide-react"

type Profile = {
  businessName: string
  bio: string
  city: string
  postalCode: string
  country: string
  serviceRadiusKm: number
  carbonOffsetEnabled: boolean
}

export default function ProviderProfilePage() {
  const [profile, setProfile] = useState<Profile>({
    businessName: "",
    bio: "",
    city: "",
    postalCode: "",
    country: "DE",
    serviceRadiusKm: 25,
    carbonOffsetEnabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/providers/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) {
          setProfile({
            businessName: d.provider.businessName ?? "",
            bio: d.provider.bio ?? "",
            city: d.provider.city ?? "",
            postalCode: d.provider.postalCode ?? "",
            country: d.provider.country ?? "DE",
            serviceRadiusKm: d.provider.serviceRadiusKm ?? 25,
            carbonOffsetEnabled: d.provider.carbonOffsetEnabled ?? false,
          })
        }
        setLoading(false)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch("/api/providers/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" /></div>
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Profile</h1>
        <p className="text-sm text-[#6B7280] mt-1">Your public business profile visible to customers</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">Business name</label>
          <input
            type="text"
            value={profile.businessName}
            onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            rows={4}
            placeholder="Describe your services and eco commitment..."
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">City</label>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">Postal code</label>
            <input
              type="text"
              value={profile.postalCode}
              onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">
            Service radius: {profile.serviceRadiusKm} km
          </label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={profile.serviceRadiusKm}
            onChange={(e) => setProfile((p) => ({ ...p, serviceRadiusKm: Number(e.target.value) }))}
            className="w-full accent-[#2D7A5F]"
          />
          <div className="flex justify-between text-xs text-[#6B7280] mt-1">
            <span>5 km</span>
            <span>100 km</span>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={profile.carbonOffsetEnabled}
            onChange={(e) => setProfile((p) => ({ ...p, carbonOffsetEnabled: e.target.checked }))}
            className="h-4 w-4 accent-[#2D7A5F]"
          />
          <div>
            <p className="text-sm font-medium text-[#2B3441]">Enable carbon offset option</p>
            <p className="text-xs text-[#6B7280]">Allow customers to add a carbon offset contribution at checkout</p>
          </div>
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2D7A5F] py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  )
}
