"use client"

import { useState, useEffect, useCallback } from "react"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { Loader2, Scale } from "lucide-react"

type DisputeRow = {
  id: string
  bookingId: string
  status: string
  reason: string
  description: string
  resolutionAmount: number | null
  createdAt: string
  resolvedAt: string | null
  bookingNumber: string | null
  totalAmount: number | null
  openerEmail: string | null
  openerFirstName: string | null
  openerLastName: string | null
}

type FilterType = "open" | "escalated" | "all"

export default function AdminDisputesPage() {
  const [filter, setFilter] = useState<FilterType>("open")
  const [disputes, setDisputes] = useState<DisputeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DisputeRow | null>(null)
  const [resolving, setResolving] = useState(false)
  const [form, setForm] = useState({ outcome: "resolved_customer", resolution: "", refundPercent: 0 })

  const reload = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/disputes?status=${filter}`)
      .then((r) => r.json())
      .then((d) => { setDisputes(d.disputes ?? []); setLoading(false) })
  }, [filter])

  useEffect(() => { reload() }, [reload])

  const resolve = async () => {
    if (!selected) return
    setResolving(true)
    const res = await fetch(`/api/admin/disputes/${selected.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setResolving(false)
    if (res.ok) {
      setSelected(null)
      setForm({ outcome: "resolved_customer", resolution: "", refundPercent: 0 })
      reload()
    }
  }

  const filters: FilterType[] = ["open", "escalated", "all"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Disputes</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Review and resolve customer-provider disputes</p>
      </div>

      <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm w-fit">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === f ? "bg-[#2D7A5F] text-white" : "text-[#6B7280] hover:text-[#2B3441]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* List */}
        <div className="xl:col-span-3 rounded-xl bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" />
            </div>
          ) : disputes.length === 0 ? (
            <p className="text-center py-20 text-sm text-[#6B7280]">No {filter} disputes</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {disputes.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className={`w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors ${selected?.id === d.id ? "bg-[#2D7A5F]/5 border-l-2 border-[#2D7A5F]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={d.status} />
                        <span className="text-xs text-[#6B7280]">{d.bookingNumber ?? d.bookingId.slice(0, 8)}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#2B3441] capitalize">{d.reason.replace(/_/g, " ")}</p>
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">{d.description.slice(0, 80)}…</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#2B3441]">€{((d.totalAmount ?? 0) / 100).toFixed(2)}</p>
                      <p className="text-xs text-[#6B7280]">{new Date(d.createdAt).toLocaleDateString("de-DE")}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resolution Panel */}
        <div className="xl:col-span-2">
          {selected ? (
            <div className="rounded-xl bg-white shadow-sm p-6 space-y-5 sticky top-24">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-[#2D7A5F]" />
                <h2 className="font-semibold text-[#2B3441]">Resolve Dispute</h2>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">Booking</span><span className="font-medium">{selected.bookingNumber}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Opened by</span><span className="font-medium">{selected.openerEmail}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Booking value</span><span className="font-medium">€{((selected.totalAmount ?? 0) / 100).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Reason</span><span className="font-medium capitalize">{selected.reason.replace(/_/g, " ")}</span></div>
              </div>

              <p className="text-sm text-[#6B7280] bg-gray-50 rounded-lg p-3 leading-relaxed">{selected.description}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">Outcome</label>
                  <select
                    value={form.outcome}
                    onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
                  >
                    <option value="resolved_customer">Resolved — Customer wins</option>
                    <option value="resolved_provider">Resolved — Provider wins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">Refund %</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={form.refundPercent}
                      onChange={(e) => setForm((f) => ({ ...f, refundPercent: Number(e.target.value) }))}
                      className="flex-1 accent-[#2D7A5F]"
                    />
                    <span className="text-sm font-bold text-[#2B3441] w-10 text-right">{form.refundPercent}%</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Refund: €{((selected.totalAmount ?? 0) * form.refundPercent / 10000).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">Resolution notes (min. 10 chars)</label>
                  <textarea
                    value={form.resolution}
                    onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))}
                    rows={4}
                    placeholder="Explain your decision..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F] resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-[#6B7280] hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={resolve}
                    disabled={resolving || form.resolution.length < 10}
                    className="flex-1 rounded-lg bg-[#2D7A5F] py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors"
                  >
                    {resolving ? "Resolving…" : "Resolve Dispute"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white shadow-sm p-10 text-center text-[#6B7280] text-sm">
              <Scale className="h-8 w-8 mx-auto mb-3 text-gray-300" />
              Select a dispute to resolve it
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
