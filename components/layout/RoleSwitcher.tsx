"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Leaf, Home, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

interface Props {
  currentRole: "customer" | "provider"
  targetRole: "customer" | "provider"
}

const ROLE_META = {
  provider: {
    icon: Leaf,
    color: "text-[#2D7A5F]",
    bg: "bg-[#EDF5F0]",
    accentBg: "bg-[#EDF5F0]",
    accentBorder: "border-[#2D7A5F]/20",
    accentIcon: "text-[#2D7A5F]",
  },
  customer: {
    icon: Home,
    color: "text-[#2B3441]",
    bg: "bg-[#F4FAF6]",
    accentBg: "bg-[#FFF9F0]",
    accentBorder: "border-amber-200",
    accentIcon: "text-amber-500",
  },
}

export function RoleSwitcher({ currentRole, targetRole }: Props) {
  const t = useTranslations("compLayoutRoleSwitcher")
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = ROLE_META[currentRole]
  const target  = ROLE_META[targetRole]
  const CurrentIcon = current.icon
  const TargetIcon  = target.icon

  const roleLabel = (role: "customer" | "provider") =>
    role === "provider" ? t("cleanerAccount") : t("providerAccount")
  const currentLabel = roleLabel(currentRole)
  const targetLabel  = roleLabel(targetRole)
  const targetToastTitle =
    targetRole === "provider" ? t("toastTitleCleaner") : t("toastTitleProvider")
  const targetToastDesc =
    targetRole === "provider" ? t("toastDescCleaner") : t("toastDescProvider")

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
        setError((data as { error?: string }).error ?? t("switchFailed"))
        setSwitching(false)
        return
      }

      // Show the toast NOW — while still on this page — so the Toaster
      // is guaranteed to be in the DOM and the notification is visible.
      // After a short pause we navigate, giving the toast time to render.
      toast.success(targetToastTitle, {
        description: targetToastDesc,
        icon: <TargetIcon size={16} className={target.color} />,
        duration: 5000,
      })

      // Brief delay so the toast appears before the page transitions
      await new Promise(r => setTimeout(r, 400))
      router.push((data as { redirectTo?: string }).redirectTo ?? "/")
    } catch {
      setError(t("networkError"))
      setSwitching(false)
    }
  }

  return (
    <>
      {/* Compact pill in navbar */}
      <button
        onClick={() => { if (!switching) setShowModal(true) }}
        disabled={switching}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
          ${current.bg} ${current.color} border-current/20 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <CurrentIcon size={12} />
        {currentLabel}
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
                  <p className="font-semibold text-[#2B3441] text-base">{t("switchingAccount")}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{t("takingYouTo", { role: targetLabel })}</p>
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
                    <h2 className="font-semibold text-[#2B3441] text-base">{t("switchTo", { role: targetLabel })}</h2>
                    <p className="text-xs text-[#6B7280]">{t("currentlyIn", { role: currentLabel })}</p>
                  </div>
                </div>

                {/* Role transition visual */}
                <div className="flex items-center gap-2 rounded-xl bg-[#F8FAF9] border border-[#E5EDE9] px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <CurrentIcon size={14} className={current.color} />
                    <span className="text-xs font-medium text-[#2B3441]">{currentLabel}</span>
                  </div>
                  <ArrowLeftRight size={12} className="text-[#6B7280] mx-1 flex-shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <TargetIcon size={14} className={target.color} />
                    <span className="text-xs font-semibold text-[#2B3441]">{targetLabel}</span>
                  </div>
                </div>

                {/* Fraud warning */}
                <div className={`flex items-start gap-2.5 rounded-xl p-3 border ${target.accentBg} ${target.accentBorder}`}>
                  <AlertTriangle size={14} className={`${target.accentIcon} mt-0.5 shrink-0`} />
                  <p className="text-xs text-[#2B3441] leading-relaxed">
                    {targetRole === "provider"
                      ? t("warningCleaner")
                      : t("warningProvider")}
                  </p>
                </div>

                {error && <p className="text-xs text-red-600 text-center">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowModal(false); setError(null) }}
                    className="flex-1 h-10 rounded-xl border border-[#E5EDE9] text-sm font-medium text-[#6B7280] hover:bg-[#F4FAF6] transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleSwitch}
                    className="flex-1 h-10 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <TargetIcon size={13} />
                    {t("switchNow")}
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
