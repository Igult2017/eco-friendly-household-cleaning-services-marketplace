"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

interface FormState {
  code: string
  discountType: "percentage" | "fixed"
  discountValue: string
  minOrderCents: string
  maxDiscountCents: string
  maxUses: string
  expiresAt: string
}

const defaultForm: FormState = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  minOrderCents: "",
  maxDiscountCents: "",
  maxUses: "",
  expiresAt: "",
}

export function PromoCodeCreateForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const next = { ...e }; delete next[field]; return next })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.code.trim() || form.code.trim().length < 3) errs.code = "Code must be at least 3 characters"
    const val = Number(form.discountValue)
    if (!form.discountValue || isNaN(val) || val <= 0) errs.discountValue = "Must be a positive number"
    if (form.discountType === "percentage" && val > 100) errs.discountValue = "Percentage cannot exceed 100"
    if (form.minOrderCents && (isNaN(Number(form.minOrderCents)) || Number(form.minOrderCents) < 0))
      errs.minOrderCents = "Must be 0 or more"
    if (form.maxDiscountCents && (isNaN(Number(form.maxDiscountCents)) || Number(form.maxDiscountCents) <= 0))
      errs.maxDiscountCents = "Must be positive"
    if (form.maxUses && (isNaN(Number(form.maxUses)) || Number(form.maxUses) <= 0))
      errs.maxUses = "Must be a positive integer"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setSuccess(false)
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderCents: form.minOrderCents ? Number(form.minOrderCents) : 0,
      }
      if (form.maxDiscountCents) body.maxDiscountCents = Number(form.maxDiscountCents)
      if (form.maxUses) body.maxUses = Number(form.maxUses)
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString()

      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.error?.fieldErrors) {
          const fe: Record<string, string> = {}
          for (const [k, v] of Object.entries(data.error.fieldErrors)) {
            fe[k] = (v as string[])[0] ?? "Invalid"
          }
          setErrors(fe)
        } else {
          setErrors({ _global: data?.error ?? "Something went wrong" })
        }
        return
      }
      setSuccess(true)
      setForm(defaultForm)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-[#E5EBF0] bg-white px-3 py-2 text-sm text-[#2B3441] placeholder-[#9CA3AF] focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
  const errorClass = "mt-1 text-xs text-red-500"
  const labelClass = "mb-1 block text-xs font-medium text-[#6B7280] uppercase tracking-wide"

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-[#2B3441]">Create Promo Code</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        {errors._global && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errors._global}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Promo code created successfully.</div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Code */}
          <div>
            <label className={labelClass}>Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="SUMMER20"
              className={inputClass}
              autoComplete="off"
            />
            {errors.code && <p className={errorClass}>{errors.code}</p>}
          </div>

          {/* Discount Type */}
          <div>
            <label className={labelClass}>Type *</label>
            <select
              value={form.discountType}
              onChange={(e) => set("discountType", e.target.value as "percentage" | "fixed")}
              className={inputClass}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (EUR cents)</option>
            </select>
          </div>

          {/* Discount Value */}
          <div>
            <label className={labelClass}>
              Value * {form.discountType === "percentage" ? "(1–100)" : "(cents)"}
            </label>
            <input
              type="number"
              min={1}
              max={form.discountType === "percentage" ? 100 : undefined}
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
              placeholder={form.discountType === "percentage" ? "20" : "500"}
              className={inputClass}
            />
            {errors.discountValue && <p className={errorClass}>{errors.discountValue}</p>}
          </div>

          {/* Min Order */}
          <div>
            <label className={labelClass}>Min Order (cents)</label>
            <input
              type="number"
              min={0}
              value={form.minOrderCents}
              onChange={(e) => set("minOrderCents", e.target.value)}
              placeholder="0"
              className={inputClass}
            />
            {errors.minOrderCents && <p className={errorClass}>{errors.minOrderCents}</p>}
          </div>

          {/* Max Discount */}
          {form.discountType === "percentage" && (
            <div>
              <label className={labelClass}>Max Discount (cents)</label>
              <input
                type="number"
                min={1}
                value={form.maxDiscountCents}
                onChange={(e) => set("maxDiscountCents", e.target.value)}
                placeholder="2000"
                className={inputClass}
              />
              {errors.maxDiscountCents && <p className={errorClass}>{errors.maxDiscountCents}</p>}
            </div>
          )}

          {/* Max Uses */}
          <div>
            <label className={labelClass}>Max Uses</label>
            <input
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => set("maxUses", e.target.value)}
              placeholder="Unlimited"
              className={inputClass}
            />
            {errors.maxUses && <p className={errorClass}>{errors.maxUses}</p>}
          </div>

          {/* Expires At */}
          <div>
            <label className={labelClass}>Expires At</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2D7A5F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245f4a] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Code
          </button>
        </div>
      </form>
    </div>
  )
}
