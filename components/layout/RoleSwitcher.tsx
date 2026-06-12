"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Leaf, Home, AlertTriangle } from "lucide-react"

interface Props {
  currentRole: "customer" | "provider"
  targetRole: "customer" | "provider"
}

const ROLE_META = {
  provider: { label: "Cleaner Account", icon: Leaf,  color: "text-[#2D7A5F]", bg: "bg-[#EDF5F0]" },
  customer: { label: "Provider Account", icon: Home, color: "text-[#2B3441]", bg: "bg-[#F4FAF6]" },
}

export function RoleSwitcher({ currentRole, targetRole }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = ROLE_META[currentRole]
  const target  = ROLE_META[targetRole]
  const CurrentIcon = current.icon
  const TargetIcon  = target.icon

  async function handleSwitch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/users/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Switch failed")
        setLoading(false)
        return
      }
      router.push((data as { redirectTo?: string }).redirectTo ?? "/")
    } catch {
      setError("Network error. Try again.")
      setLoading(false)
    }
  }

  return (
    <>
      {/* Compact pill in navbar */}
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
          ${current.bg} ${current.color} border-current/20 hover:opacity-80`}
      >
        <CurrentIcon size={12} />
        {current.label}
        <ArrowLeftRight size={10} className="opacity-60" />
      </button>

      {/* Switch confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <ArrowLeftRight size={18} className="text-amber-500" />
              </div>
              <div>
                <h2 className="font-semibold text-[#2B3441] text-base">Switch to {target.label}</h2>
                <p className="text-xs text-[#6B7280]">You will leave {current.label}</p>
              </div>
            </div>

            <div className={`flex items-start gap-2.5 rounded-xl p-3 border ${targetRole === "provider" ? "bg-[#EDF5F0] border-[#2D7A5F]/20" : "bg-[#FFF9F0] border-amber-200"}`}>
              <AlertTriangle size={14} className={targetRole === "provider" ? "text-[#2D7A5F] mt-0.5 shrink-0" : "text-amber-500 mt-0.5 shrink-0"} />
              <p className="text-xs text-[#2B3441] leading-relaxed">
                {targetRole === "provider"
                  ? "You will see the cleaner dashboard. Job posts you made as a Provider are hidden to prevent bidding on your own work."
                  : "You will see the provider dashboard. You will not be able to bid on jobs you posted as a Provider Account."}
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 text-center">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setError(null) }}
                className="flex-1 h-10 rounded-xl border border-[#E5EDE9] text-sm font-medium text-[#6B7280] hover:bg-[#F4FAF6] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitch}
                disabled={loading}
                className="flex-1 h-10 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <TargetIcon size={13} />
                {loading ? "Switching…" : `Go to ${target.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
