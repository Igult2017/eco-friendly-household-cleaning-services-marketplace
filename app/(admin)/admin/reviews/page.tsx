"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Eye, EyeOff, Flag, CheckCircle2 } from "lucide-react"

type ReviewRow = {
  id: string
  overallRating: number
  title: string | null
  body: string | null
  isFlagged: boolean
  adminNote: string | null
  isPublic: boolean
  createdAt: string
  providerBusinessName: string | null
  customerEmail: string | null
  customerFirstName: string | null
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    fetch("/api/admin/reviews")
      .then((r) => r.json())
      .then((d) => { setReviews(d.reviews ?? []); setLoading(false) })
  }, [])

  useEffect(() => { reload() }, [reload])

  async function patch(id: string, body: Record<string, unknown>) {
    setActioning(id)
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setActioning(null)
    reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Reviews Moderation</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {reviews.length} recent reviews — flag, hide, or restore
        </p>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-center py-20 text-sm text-[#6B7280]">No reviews yet</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Customer", "Provider", "Rating", "Content", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reviews.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50/50 transition-colors ${r.isFlagged ? "bg-red-50/30" : ""} ${!r.isPublic ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 text-xs text-[#6B7280]">{r.customerEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">{r.providerBusinessName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold text-sm ${r.overallRating >= 4 ? "text-[#2D7A5F]" : r.overallRating <= 2 ? "text-red-500" : "text-[#2B3441]"}`}>
                      ★ {r.overallRating}/5
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {r.title && <p className="text-sm font-medium text-[#2B3441] truncate">{r.title}</p>}
                    {r.body && <p className="text-xs text-[#6B7280] truncate">{r.body}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {r.isFlagged && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">Flagged</span>
                      )}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.isPublic ? "Public" : "Hidden"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6B7280] whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3">
                    {actioning === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => patch(r.id, { isPublic: !r.isPublic })}
                          title={r.isPublic ? "Hide review" : "Make public"}
                          className={`p-1.5 rounded-lg transition-colors ${r.isPublic ? "hover:bg-gray-100 text-[#6B7280]" : "hover:bg-green-50 text-green-600"}`}
                        >
                          {r.isPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => patch(r.id, { isFlagged: !r.isFlagged })}
                          title={r.isFlagged ? "Remove flag" : "Flag review"}
                          className={`p-1.5 rounded-lg transition-colors ${r.isFlagged ? "hover:bg-red-50 text-red-500" : "hover:bg-amber-50 text-amber-500"}`}
                        >
                          {r.isFlagged ? <CheckCircle2 className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
                        </button>
                      </div>
                    )}
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
