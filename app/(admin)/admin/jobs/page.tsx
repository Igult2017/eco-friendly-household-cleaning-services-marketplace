"use client"

import { useEffect, useState } from "react"
import { Loader2, Trash2, Briefcase } from "lucide-react"

type AdminJob = {
  id: string
  title: string
  status: string
  createdAt: string
  desiredDate: string | null
  budgetMin: number | null
  serviceAddress: { city?: string; country?: string } | null
  customerName: string | null
  customerEmail: string | null
  bidCount: number
}

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  bidding: "bg-emerald-100 text-emerald-700",
  assigned: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-500",
}

// Admin job-board moderation: see every posted job and remove any of them (bids + job chat go
// with it; the owner is notified). Admin panel is deliberately English-only.
export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = () =>
    fetch("/api/admin/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  async function remove(job: AdminJob) {
    if (!window.confirm(`Delete “${job.title}”? Its bids and job chat are removed and the client is notified. This cannot be undone.`)) return
    setDeleting(job.id)
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, { method: "DELETE" })
      if (res.ok) setJobs((prev) => prev.filter((j) => j.id !== job.id))
      else alert((await res.json().catch(() => ({}))).error ?? "Could not delete the job.")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] flex items-center gap-2">
          <Briefcase size={26} className="text-[#2D7A5F]" /> Job Board
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">Every posted job — remove anything that violates the rules.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#2D7A5F]" /></div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-[#6B7280]">No jobs posted yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-[#6B7280]">
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bids</th>
                <th className="px-4 py-3">Posted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-[#F4FAF6]/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#2B3441]">{j.title}</p>
                    <p className="text-xs text-[#9CA3AF]">{j.serviceAddress?.city ?? "—"}{j.serviceAddress?.country ? `, ${j.serviceAddress.country}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#2B3441]">{j.customerName ?? "—"}</p>
                    <p className="text-xs text-[#9CA3AF]">{j.customerEmail ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[j.status] ?? "bg-gray-100 text-gray-600"}`}>{j.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[#2B3441]">{j.bidCount}</td>
                  <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(j.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(j)}
                      disabled={deleting === j.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {deleting === j.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
