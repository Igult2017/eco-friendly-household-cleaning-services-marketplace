"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { AlertCircle, AlertTriangle } from "lucide-react"

// Tells a cleaner what to do when their account isn't active: complete the profile (approval is
// automatic) or — if suspended — contact support. Renders nothing once approved + not suspended.
export function ProviderApprovalNotice({
  isApproved,
  isSuspended,
}: {
  isApproved: boolean
  isSuspended: boolean
}) {
  const t = useTranslations("approvalNotice")

  if (isSuspended) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
        <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">{t("suspendedTitle")}</p>
          <p className="text-sm text-red-700">{t("suspendedBody")}</p>
        </div>
      </div>
    )
  }

  if (!isApproved) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
        <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">{t("pendingTitle")}</p>
          <p className="text-sm text-amber-700 mb-2">{t("pendingBody")}</p>
          <Link
            href="/provider/profile"
            className="inline-flex items-center rounded-lg bg-[#2D7A5F] hover:bg-[#235f49] text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            {t("pendingCta")}
          </Link>
        </div>
      </div>
    )
  }

  return null
}
