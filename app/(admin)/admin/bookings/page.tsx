"use client"

import { useState, useEffect, useCallback } from "react"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react"

type BookingRow = {
  id: string
  bookingNumber: string
  status: string
  scheduledAt: string | null
  totalAmount: number
  subtotalAmount: number
  platformFeeAmount: number
  createdAt: string
  customerFirstName: string | null
  customerLastName: string | null
  customerEmail: string | null
  providerBusinessName: string | null
}

const STATUS_FILTERS = ["all", "confirmed", "in_progress", "completed", "cancelled", "disputed", "refunded"]
const PAGE_LIMIT = 20

export default function AdminBookingsPage() {
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    params.set("page", String(page))
    fetch(`/api/admin/bookings?${params}`)
      .then((r) => r.json())
      .then((d) => { setBookings(d.bookings ?? []); setLoading(false) })
  }, [status, page])

  useEffect(() => { reload() }, [reload])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Bookings</h1>
        <p className="mt-1 text-sm text-[#6B7280]">All marketplace bookings</p>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all border ${
              status === s
                ? "border-[#2D7A5F] bg-[#2D7A5F] text-white"
                : "border-gray-200 text-[#6B7280] hover:border-[#2D7A5F] hover:text-[#2D7A5F] bg-white"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-center py-20 text-sm text-[#6B7280]">No bookings found</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Booking #", "Customer", "Provider", "Scheduled", "Subtotal", "Fee", "Total", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-[#2B3441] whitespace-nowrap">{b.bookingNumber}</td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                    <div>
                      <p className="font-medium text-[#2B3441]">{b.customerFirstName} {b.customerLastName}</p>
                      <p className="text-xs">{b.customerEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{b.providerBusinessName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#6B7280] whitespace-nowrap">
                    {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">€{((b.subtotalAmount ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">€{((b.platformFeeAmount ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-[#2B3441]">€{((b.totalAmount ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">
            Page {page} · {bookings.length} rows shown
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <button
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#2B3441] transition-colors"
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </button>
            )}
            {bookings.length === PAGE_LIMIT && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2D7A5F] hover:text-[#245f4a] transition-colors"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
