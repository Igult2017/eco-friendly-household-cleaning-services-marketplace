"use client"

import { useState, useEffect } from "react"
import { Loader2, Save, User } from "lucide-react"

type Profile = {
  firstName: string
  lastName: string
  email: string
  phone: string
  marketingConsent: boolean
}

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState<Profile>({
    firstName: "", lastName: "", email: "", phone: "", marketingConsent: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/customers/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setProfile({
            firstName: d.user.firstName ?? "",
            lastName: d.user.lastName ?? "",
            email: d.user.email ?? "",
            phone: d.user.phone ?? "",
            marketingConsent: d.user.marketingConsent ?? false,
          })
        }
        setLoading(false)
      })
  }, [])

  const save = async () => {
    setError("")
    setSaving(true)
    const res = await fetch("/api/customers/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        marketingConsent: profile.marketingConsent,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError("Failed to save. Please try again.")
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" /></div>
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">My Profile</h1>
        <p className="text-sm text-[#6B7280] mt-1">Your personal details and contact information</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2D7A5F]/10">
            <User className="h-5 w-5 text-[#2D7A5F]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#2B3441]">Personal information</p>
            <p className="text-xs text-[#6B7280]">Address for bookings is set at checkout</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">First name</label>
            <input
              type="text" value={profile.firstName}
              onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">Last name</label>
            <input
              type="text" value={profile.lastName}
              onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">Email</label>
          <input
            type="email" value={profile.email} disabled
            className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-[#6B7280] cursor-not-allowed"
          />
          <p className="text-xs text-[#9CA3AF] mt-1">Email is managed through your account settings</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2B3441] mb-1.5">Phone number</label>
          <input
            type="tel" value={profile.phone} placeholder="+49 123 456 7890"
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
          />
          <p className="text-xs text-[#9CA3AF] mt-1">Used to contact you about bookings</p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox" checked={profile.marketingConsent}
            onChange={(e) => setProfile((p) => ({ ...p, marketingConsent: e.target.checked }))}
            className="h-4 w-4 accent-[#2D7A5F]"
          />
          <div>
            <p className="text-sm font-medium text-[#2B3441]">Marketing emails</p>
            <p className="text-xs text-[#6B7280]">Receive tips, offers, and seasonal promotions</p>
          </div>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2D7A5F] py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  )
}
