"use client"

import { useState, useEffect, useCallback } from "react"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { DeleteCleanerDialog } from "@/components/admin/DeleteCleanerDialog"
import { PauseCircle, PlayCircle, Loader2, Check, X } from "lucide-react"

type ProviderRow = {
  id: string
  businessName: string
  bio: string | null
  city: string | null
  postalCode: string | null
  country: string
  ecoLevel: string
  verificationStatus: string
  stripeAccountStatus: string | null
  isApproved: boolean
  isSuspended: boolean
  averageRating: number | null
  totalReviews: number
  totalJobsCompleted: number
  profilePhotoUrl: string | null
  createdAt: string
  userEmail: string | null
}

type TabType = "pending" | "approved" | "suspended"

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span title={label} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"}`}>
      {ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

function Criteria({ p }: { p: ProviderRow }) {
  const hasBio = (p.bio?.length ?? 0) >= 20
  const hasCity = Boolean(p.city)
  const hasPostal = Boolean(p.postalCode)
  const hasEco = Boolean(p.ecoLevel)
  const idVerified = p.verificationStatus === "verified"
  const stripeReady = ["active", "charges_enabled"].includes(p.stripeAccountStatus ?? "")
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      <Tick ok={hasBio} label="Bio" />
      <Tick ok={hasCity} label="City" />
      <Tick ok={hasPostal} label="Postal" />
      <Tick ok={hasEco} label="Eco" />
      <Tick ok={idVerified} label="ID" />
      <Tick ok={stripeReady} label="Stripe" />
    </div>
  )
}

async function fetchProviders(status: TabType): Promise<ProviderRow[]> {
  const res = await fetch(`/api/admin/providers?status=${status}`)
  const data = await res.json()
  return data.providers ?? []
}

async function takeAction(providerId: string, action: string) {
  await fetch(`/api/admin/providers/${providerId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  })
}

export default function AdminProvidersPage() {
  const [tab, setTab] = useState<TabType>("pending")
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    fetchProviders(tab).then((rows) => { setProviders(rows); setLoading(false) })
  }, [tab])

  useEffect(() => { reload() }, [reload])

  const handle = async (id: string, action: string) => {
    setActioning(id)
    await takeAction(id, action)
    setActioning(null)
    reload()
  }

  const tabs: TabType[] = ["pending", "approved", "suspended"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Cleaners</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Approval is automatic once a cleaner completes their profile — you can suspend (ban) or reinstate accounts.</p>
      </div>

      <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-[#2D7A5F] text-white shadow-sm" : "text-[#6B7280] hover:text-[#2B3441]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" />
          </div>
        ) : providers.length === 0 ? (
          <p className="text-center py-20 text-sm text-[#6B7280]">No {tab} providers</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Provider", "Location", "Criteria", "Verification", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.profilePhotoUrl ? (
                        <img src={p.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-[#2D7A5F]/10 flex items-center justify-center text-[#2D7A5F] font-bold text-sm">
                          {p.businessName[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#2B3441]">{p.businessName}</p>
                        <p className="text-xs text-[#6B7280]">{p.userEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{[p.city, p.country].filter(Boolean).join(", ")}</td>
                  <td className="px-4 py-3"><Criteria p={p} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.verificationStatus} /></td>
                  <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(p.createdAt).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {actioning === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                      ) : (
                        <>
                          {!p.isSuspended ? (
                            <button onClick={() => handle(p.id, "suspend")} title="Suspend / ban" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
                              <PauseCircle className="h-4 w-4" />
                            </button>
                          ) : (
                            <button onClick={() => handle(p.id, "unsuspend")} title="Reinstate" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                              <PlayCircle className="h-4 w-4" />
                            </button>
                          )}
                          <DeleteCleanerDialog id={p.id} name={p.businessName} onDeleted={reload} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
