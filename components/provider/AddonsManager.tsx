"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"

type Addon = { id: string; name: string; priceCents: number; isActive: boolean }

// Lets a cleaner define paid add-ons (e.g. oven cleaning, ironing) that customers
// can select during booking. Prices flow into the booking subtotal.
export function AddonsManager() {
  const t = useTranslations("compProviderAddons")
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    fetch("/api/provider/addons")
      .then((r) => r.json())
      .then((d) => { setAddons(Array.isArray(d.addons) ? d.addons : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  const add = async () => {
    const cents = Math.round(Number(price) * 100)
    if (!name.trim() || !cents || cents < 50) { setError(t("invalid")); return }
    setAdding(true)
    setError(null)
    const res = await fetch("/api/provider/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), priceCents: cents }),
    })
    if (!res.ok) setError(t("addFailed"))
    else { setName(""); setPrice("") }
    setAdding(false)
    reload()
  }

  const remove = async (id: string) => {
    await fetch("/api/provider/addons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addonId: id }),
    })
    reload()
  }

  return (
    <div className="rounded-xl bg-white shadow-sm p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-[#2B3441]">{t("title")}</h2>
        <p className="text-xs text-[#6B7280] mt-1">{t("subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#2D7A5F]" /></div>
      ) : addons.length === 0 ? (
        <p className="text-sm text-[#6B7280]">{t("empty")}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {addons.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm font-medium text-[#2B3441]">{a.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-[#2D7A5F]">{formatCurrency(a.priceCents)}</span>
                <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" aria-label={t("remove")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <input
          type="text" value={name} onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder={t("namePlaceholder")} maxLength={120}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
        />
        <input
          type="number" min="0.5" step="0.5" value={price} onChange={(e) => { setPrice(e.target.value); setError(null) }}
          placeholder={t("pricePlaceholder")}
          className="w-28 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
        />
        <button onClick={add} disabled={adding} className="flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256349] disabled:opacity-50 transition-colors shrink-0">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("addButton")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
