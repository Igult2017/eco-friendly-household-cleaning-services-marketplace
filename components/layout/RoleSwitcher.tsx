"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Leaf, Home, AlertTriangle, Loader2 } from "lucide-react"

interface Props {
  currentRole: "customer" | "provider"
  targetRole: "customer" | "provider"
}

const ROLE_META = {
  provider: {
    label: "Cleaner Account",
    icon: Leaf,
    color: "text-[#2D7A5F]",
    bg: "bg-[#EDF5F0]",
    accentBg: "bg-[#EDF5F0]",
    accentBorder: "border-[#2D7A5F]/20",
    accentIcon: "text-[#2D7A5F]",
  },
  customer: {
    label: "Provider Account",
    icon: Home,
    color: "text-[#2B3441]",
    bg: "bg-[#F4FAF6]",
    accentBg: "bg-[#FFF9F0]",
    accentBorder: "border-amber-200",
    accentIcon: "text-amber-500",
  },
}

export function RoleSwitcher({ currentRole, targetRole }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = ROLE_META[currentRole]
  const target  = ROLE_META[targetRole]
  const CurrentIcon = current.icon
  const TargetIcon  = target.icon

  async function handleSwitch() {
    setSwitching(true)
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
        setSwitching(false)
        return
      }
      // Signal the destination page to show a toast on arrival
      try { sessionStorage.setItem("dorix_switched_to", targetRole) } catch {}
      router.push((data as { redirectTo?: string }).redirectTo ?? "/")
    } catch {
      setError("Network error. Try again.")
      setSwitching(false)
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">

            {/* Switching state — full-card overlay */}
            {switching ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-[#EDF5F0]" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#2D7A5F] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <TargetIcon size={20} className="text-[#2D7A5F]" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-[#2B3441] text-base">Switching account…</p>
                  <p className="text-xs text-[#6B7280] mt-1">Taking you to your {target.label}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <ArrowLeftRight size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#2B3441] text-base">Switch to {target.label}</h2>
                    <p className="text-xs text-[#6B7280]">You are currently in {current.label}</p>
                  </div>
                </div>

                {/* Role transition visual */}
                <div className="flex items-center gap-2 rounded-xl bg-[#F8FAF9] border border-[#E5EDE9] px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <CurrentIcon size={14} className={current.color} />
                    <span className="text-xs font-medium text-[#2B3441]">{current.label}</span>
                  </div>
                  <ArrowLeftRight size={12} className="text-[#6B7280] mx-1 flex-shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <TargetIcon size={14} className={target.color} />
                    <span className="text-xs font-semibold text-[#2B3441]">{target.label}</span>
                  </div>
                </div>

                {/* Fraud warning */}
                <div className={`flex items-start gap-2.5 rounded-xl p-3 border ${target.accentBg} ${target.accentBorder}`}>
                  <AlertTriangle size={14} className={`${target.accentIcon} mt-0.5 shrink-0`} />
                  <p className="text-xs text-[#2B3441] leading-relaxed">
                    {targetRole === "provider"
                      ? "You will see the Cleaner dashboard. Jobs you posted as a Provider will be hidden to prevent bidding on your own work."
                      : "You will see the Provider dashboard. You cannot bid on jobs you previously posted as a Provider."}
                  </p>
                </div>

                {error && <p className="text-xs text-red-600 text-center">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowModal(false); setError(null) }}
                    className="flex-1 h-10 rounded-xl border border-[#E5EDE9] text-sm font-medium text-[#6B7280] hover:bg-[#F4FAF6] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSwitch}
                    className="flex-1 h-10 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <TargetIcon size={13} />
                    Switch now
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
