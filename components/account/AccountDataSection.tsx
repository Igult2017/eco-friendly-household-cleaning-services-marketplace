"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Download, Trash2, Loader2 } from "lucide-react"

// GDPR self-service: export (Art. 20) + delete (Art. 17). Wires the existing /api/gdpr/* endpoints,
// which previously had no UI. Used on both the client and cleaner profile pages.
export function AccountDataSection() {
  const t = useTranslations("accountData")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteAccount() {
    if (!confirm(t("deleteConfirm"))) return
    setDeleting(true)
    setError(null)
    try {
      const r = await fetch("/api/gdpr/delete", { method: "POST" })
      if (!r.ok) {
        setError(t("deleteError"))
        setDeleting(false)
        return
      }
      window.location.href = "/"
    } catch {
      setError(t("deleteError"))
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl bg-white shadow-sm p-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#2B3441]">{t("title")}</p>
        <p className="text-xs text-[#6B7280] mt-0.5">{t("subtitle")}</p>
      </div>

      <a
        href="/api/gdpr/export"
        className="inline-flex items-center gap-2 rounded-xl border border-[#E5EBF0] px-4 py-2.5 text-sm font-medium text-[#2B3441] hover:bg-[#F4FAF6] transition-colors"
      >
        <Download size={15} /> {t("exportButton")}
      </a>

      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={deleteAccount}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 text-red-600 px-4 py-2.5 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {t("deleteButton")}
        </button>
        <p className="text-xs text-[#9CA3AF] mt-1.5">{t("deleteNote")}</p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  )
}
