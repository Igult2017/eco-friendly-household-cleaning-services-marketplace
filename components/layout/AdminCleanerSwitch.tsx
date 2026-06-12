"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Scissors, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function AdminCleanerSwitch() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSwitch() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/users/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: "provider" }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error((d as { error?: string }).error ?? "Could not switch accounts")
        return
      }
      toast.success("Switched to Cleaner Account", {
        description: "You are now in cleaner mode. Find and bid on nearby jobs.",
        icon: <Scissors size={16} className="text-[#2D7A5F]" />,
        duration: 5000,
      })
      await new Promise(r => setTimeout(r, 400))
      router.push("/provider/dashboard")
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSwitch}
      disabled={loading}
      className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[#EDF5F0] text-[#2D7A5F] hover:bg-[#D4EDE2] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading
        ? <Loader2 size={14} className="animate-spin" />
        : <Scissors size={14} />}
      Cleaner Account
    </button>
  )
}
