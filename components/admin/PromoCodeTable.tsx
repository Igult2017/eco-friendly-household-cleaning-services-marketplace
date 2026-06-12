"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import type { PromoCode } from "@/lib/db/schema"

interface Props {
  codes: PromoCode[]
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  )
}

export function PromoCodeTable({ codes }: Props) {
  const router = useRouter()
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function toggleActive(id: string, current: boolean) {
    setToggling(id)
    try {
      await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      })
      router.refresh()
    } finally {
      setToggling(null)
    }
  }

  async function deleteCode(id: string, code: string) {
    if (!confirm(`Delete promo code "${code}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" })
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  if (codes.length === 0) {
    return (
      <div className="rounded-xl bg-white shadow-sm">
        <p className="py-16 text-center text-sm text-[#6B7280]">No promo codes yet. Create one above.</p>
      </div>
    )
  }

  const headers = ["Code", "Type", "Value", "Uses", "Min Order", "Expires", "Status", "Actions", ""]

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {codes.map((c) => {
              const isPercentage = c.discountType === "percentage"
              const valueLabel = isPercentage
                ? `${c.discountValue}%`
                : `€${(c.discountValue / 100).toFixed(2)}`
              const usesLabel = c.maxUses ? `${c.usedCount} / ${c.maxUses}` : `${c.usedCount} / ∞`
              const minOrderLabel = c.minOrderCents > 0 ? `€${(c.minOrderCents / 100).toFixed(2)}` : "—"
              const expiresLabel = c.expiresAt
                ? new Date(c.expiresAt).toLocaleDateString("de-DE")
                : "Never"
              const isExpired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false

              return (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-[#2B3441]">{c.code}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280] capitalize">{c.discountType}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">
                    {valueLabel}
                    {isPercentage && c.maxDiscountCents && (
                      <span className="ml-1 text-xs text-[#9CA3AF]">
                        (cap €{(c.maxDiscountCents / 100).toFixed(0)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{usesLabel}</td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{minOrderLabel}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={isExpired ? "text-red-500" : "text-[#6B7280]"}>{expiresLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill isActive={c.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    {toggling === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                    ) : (
                      <button
                        onClick={() => toggleActive(c.id, c.isActive)}
                        title={c.isActive ? "Deactivate" : "Activate"}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          c.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {c.isActive ? (
                          <><ToggleLeft className="h-3.5 w-3.5" /> Deactivate</>
                        ) : (
                          <><ToggleRight className="h-3.5 w-3.5" /> Activate</>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {deleting === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                    ) : (
                      <button
                        onClick={() => deleteCode(c.id, c.code)}
                        title="Delete code"
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
