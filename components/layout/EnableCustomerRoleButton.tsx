"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

export function EnableCustomerRoleButton() {
  const router  = useRouter()
  const t = useTranslations("compLayoutEnableCustomerRoleButton")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/users/enable-dual-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? t("genericError"))
        setLoading(false)
        return
      }
      router.push((data as { redirectTo?: string }).redirectTo ?? "/dashboard")
    } catch {
      setError(t("networkError"))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {loading ? t("activating") : t("enableProviderAccount")}
      </button>
      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  )
}
