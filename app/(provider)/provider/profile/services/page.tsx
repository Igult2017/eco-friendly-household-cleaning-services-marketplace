"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Plus, Trash2, Loader2 } from "lucide-react"

type Service = {
  id: string
  categoryId: string
  categoryName: string | null
  name: string
  description: string | null
  basePrice: number
  priceUnit: string
  minDurationMinutes: number
  isActive: boolean
}

type Category = { id: string; name: string }

// per-hour and per-job only for now; per-area pricing is held until we capture home size.
const PRICE_UNITS = [
  { value: "per_hour", labelKey: "priceUnitPerHour" },
  { value: "per_job", labelKey: "priceUnitPerJob" },
]

const EMPTY_FORM = { categoryId: "", name: "", description: "", basePrice: "", priceUnit: "per_hour", minDurationMinutes: "60" }

export default function ProviderServicesPage() {
  const t = useTranslations("providerProviderProfileServicesPage")
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    fetch("/api/provider/services")
      .then((r) => r.json())
      .then((d) => { setServices(d.services ?? []); setCategories(d.categories ?? []); setLoading(false) })
  }

  useEffect(() => { reload() }, [])

  const addService = async () => {
    if (!form.categoryId || !form.name || !form.basePrice) { setError(t("errorRequiredFields")); return }
    const price = Math.round(Number(form.basePrice) * 100)
    if (price < 100) { setError(t("errorMinPrice")); return }
    setAdding(true)
    setError(null)
    const res = await fetch("/api/provider/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, basePrice: price, minDurationMinutes: Number(form.minDurationMinutes) }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error?.formErrors?.[0] ?? t("errorAddFailed")) }
    else { setForm(EMPTY_FORM); setShowForm(false) }
    setAdding(false)
    reload()
  }

  const remove = async (serviceId: string) => {
    await fetch("/api/provider/services", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId }) })
    reload()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("pageTitle")}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{t("pageSubtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("addService")}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white shadow-sm p-6 space-y-4 border border-[#2D7A5F]/20">
          <h2 className="font-semibold text-[#2B3441]">{t("newService")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("categoryLabel")}</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
              >
                <option value="">{t("selectCategory")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("serviceNameLabel")}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("serviceNamePlaceholder")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("priceLabel")}</label>
              <input
                type="number" min="1" step="0.5" value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("pricingUnitLabel")}</label>
              <select
                value={form.priceUnit}
                onChange={(e) => setForm((f) => ({ ...f, priceUnit: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
              >
                {PRICE_UNITS.map((u) => <option key={u.value} value={u.value}>{t(u.labelKey)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("minDurationLabel")}</label>
              <input
                type="number" min="30" step="30" value={form.minDurationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, minDurationMinutes: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("descriptionLabel")}</label>
              <input
                type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("descriptionPlaceholder")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(null) }} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-[#6B7280] hover:bg-gray-50">{t("cancel")}</button>
            <button onClick={addService} disabled={adding} className="flex-1 rounded-xl bg-[#2D7A5F] py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors flex items-center justify-center gap-2">
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              {adding ? t("adding") : t("addService")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#2D7A5F]" /></div>
        ) : services.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#6B7280] text-sm">{t("emptyState")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {services.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-[#2B3441] truncate">{s.name}</p>
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{s.categoryName}</span>
                  </div>
                  {s.description && <p className="text-xs text-[#6B7280] truncate">{s.description}</p>}
                  <p className="text-xs text-[#6B7280] mt-1">{t("durationMinutes", { minutes: s.minDurationMinutes })} · {(() => { const u = PRICE_UNITS.find((u) => u.value === s.priceUnit); return u ? t(u.labelKey) : "" })()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[#2D7A5F]">€{((s.basePrice ?? 0) / 100).toFixed(2)}</p>
                </div>
                <button onClick={() => remove(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
