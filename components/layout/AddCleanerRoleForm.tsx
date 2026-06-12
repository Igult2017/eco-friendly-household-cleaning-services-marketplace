"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProviderFields } from "@/app/(auth)/onboarding/ProviderFields"

type FieldKey = "businessName" | "bio" | "city" | "postalCode" | "country" | "serviceRadiusKm" | "ecoLevel"

export function AddCleanerRoleForm() {
  const router = useRouter()
  const [fields, setFields] = useState({
    businessName: "", bio: "", city: "", postalCode: "",
    country: "DE", serviceRadiusKm: "25", ecoLevel: "basic",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function update(key: FieldKey, value: string) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  const isValid = fields.businessName.trim().length >= 2
    && fields.bio.trim().length >= 20
    && fields.city.trim().length >= 2
    && fields.postalCode.trim().length >= 3

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/users/enable-dual-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          serviceRadiusKm: parseInt(fields.serviceRadiusKm) || 25,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Something went wrong.")
        return
      }
      router.push((data as { redirectTo?: string }).redirectTo ?? "/provider/dashboard")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ProviderFields values={fields} onChange={update} />

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!isValid || loading}
        className="w-full bg-[#2D7A5F] hover:bg-[#235f49] text-white h-12 text-base"
      >
        {loading ? "Setting up your Cleaner Account…" : "Activate Cleaner Account →"}
      </Button>

      <p className="text-xs text-[#6B7280] text-center">
        Your account is subject to admin approval before you can accept bookings.
      </p>
    </form>
  )
}
