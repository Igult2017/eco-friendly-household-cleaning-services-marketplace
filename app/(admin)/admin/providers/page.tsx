"use client"

import { useState, useEffect } from "react"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { CheckCircle, XCircle, PauseCircle, PlayCircle, Loader2 } from "lucide-react"

type ProviderRow = {
  id: string
  businessName: string
  city: string | null
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
  userFirstName: string | null
  userLastName: string | null
}

type TabType = "pending" | "approved" | "suspended"

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

  const reload = () => {
    setLoading(true)
    fetchProviders(tab).then((rows) => { setProviders(rows); setLoading(false) })
  }

  useEffect(() => { reload() }, [tab])

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
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Providers</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Approve, reject, or suspend service providers</p>
      </div>

      {/* Tabs */}
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

      {/* Table */}
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
                {["Provider", "Location", "Eco", "Verification", "Stripe", "Joined", "Actions"].map((h) => (
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
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{p.city}, {p.country}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.ecoLevel} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.verificationStatus} /></td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{p.stripeAccountStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(p.createdAt).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {actioning === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                      ) : (
                        <>
                          {!p.isApproved && !p.isSuspended && (
                            <>
                              <button onClick={() => handle(p.id, "approve")} title="Approve" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button onClick={() => handle(p.id, "reject")} title="Reject" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {p.isApproved && !p.isSuspended && (
                            <button onClick={() => handle(p.id, "suspend")} title="Suspend" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600">
                              <PauseCircle className="h-4 w-4" />
                            </button>
                          )}
                          {p.isSuspended && (
                            <button onClick={() => handle(p.id, "unsuspend")} title="Reinstate" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600">
                              <PlayCircle className="h-4 w-4" />
                            </button>
                          )}
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
