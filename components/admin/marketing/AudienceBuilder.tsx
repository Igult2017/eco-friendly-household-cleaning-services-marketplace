"use client"

import { useState } from "react"
import { Sparkles, Users, Loader2 } from "lucide-react"
import type { AudienceFilter } from "@/lib/marketing/types"

const inputCls = "h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"

export function AudienceBuilder({ value, onChange }: { value: AudienceFilter; onChange: (f: AudienceFilter) => void }) {
  const [goal, setGoal] = useState("")
  const [rationale, setRationale] = useState("")
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState<"ai" | "count" | null>(null)

  const set = (patch: Partial<AudienceFilter>) => onChange({ ...value, ...patch })

  async function aiSuggest() {
    if (!goal.trim()) return
    setBusy("ai"); setRationale(""); setCount(null)
    try {
      const r = await fetch("/api/admin/marketing/suggest-audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) })
      const d = await r.json()
      if (r.ok) { onChange(d.filter ?? {}); setRationale(d.rationale ?? ""); setCount(d.count ?? null) }
      else setRationale(d.error ?? "AI failed")
    } finally { setBusy(null) }
  }

  async function preview() {
    setBusy("count")
    try {
      const r = await fetch("/api/admin/marketing/audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filter: value }) })
      const d = await r.json()
      setCount(r.ok ? d.count : null)
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Describe who to target (AI picks the segment)…" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <button type="button" onClick={aiSuggest} disabled={busy === "ai"} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2B3441] text-white text-sm font-medium px-3 disabled:opacity-50">
          {busy === "ai" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI pick
        </button>
      </div>
      {rationale && <p className="text-xs text-[#2D7A5F] bg-[#F4FAF6] rounded-lg px-3 py-2">🎯 {rationale}</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-[#6B7280]">Role
          <select className={`${inputCls} w-full mt-1`} value={value.role ?? "all"} onChange={(e) => set({ role: e.target.value as AudienceFilter["role"] })}>
            <option value="all">Everyone</option>
            <option value="customer">Clients</option>
            <option value="provider">Cleaners</option>
          </select>
        </label>
        <label className="text-xs text-[#6B7280]">Booking status
          <select className={`${inputCls} w-full mt-1`} value={value.hasBooked ? "has" : value.noBookings ? "none" : "any"} onChange={(e) => set({ hasBooked: e.target.value === "has" || undefined, noBookings: e.target.value === "none" || undefined })}>
            <option value="any">Any</option>
            <option value="has">Has booked</option>
            <option value="none">Never booked</option>
          </select>
        </label>
        <label className="text-xs text-[#6B7280]">Signed up within (days)
          <input type="number" min={1} className={`${inputCls} w-full mt-1`} value={value.signedUpWithinDays ?? ""} onChange={(e) => set({ signedUpWithinDays: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label className="text-xs text-[#6B7280]">Dormant &gt; (days)
          <input type="number" min={1} className={`${inputCls} w-full mt-1`} value={value.signedUpMoreThanDays ?? ""} onChange={(e) => set({ signedUpMoreThanDays: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-[#6B7280]">
        <input type="checkbox" checked={value.onlyConsented ?? true} onChange={(e) => set({ onlyConsented: e.target.checked })} />
        Marketing-consented only (required for non-welcome — GDPR)
      </label>

      <button type="button" onClick={preview} disabled={busy === "count"} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2D7A5F] hover:underline">
        {busy === "count" ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
        Preview audience{count !== null ? `: ${count} recipient${count === 1 ? "" : "s"}` : ""}
      </button>
    </div>
  )
}
