import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/formatCurrency"

type PendingBooking = {
  id: string
  bookingNumber: string
  totalAmount: number
  provider: { businessName: string } | null
  service: { name: string } | null
}

type JobWithBids = {
  id: string
  title: string
  bids: Array<{ status: string }>
}

export function DashboardActions({ pendingBookings, jobsWithBids }: {
  pendingBookings: PendingBooking[]
  jobsWithBids: JobWithBids[]
}) {
  if (pendingBookings.length === 0 && jobsWithBids.length === 0) return null
  const total = pendingBookings.length + jobsWithBids.length

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle size={18} className="text-amber-600" />
        <h2 className="font-semibold text-[#2B3441]">Action Required</h2>
        <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
          {total} item{total !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {pendingBookings.map(b => (
          <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#2B3441]">{b.bookingNumber} — Payment due</p>
              <p className="text-xs text-[#6B7280]">
                {b.service?.name ?? "Cleaning"} with {b.provider?.businessName ?? "provider"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-bold text-sm text-[#2B3441]">{formatCurrency(b.totalAmount)}</span>
              <Link href={`/bookings/${b.id}`}>
                <Button size="sm" className="h-7 bg-[#2D7A5F] hover:bg-[#235f49] text-white text-xs">
                  Pay now
                </Button>
              </Link>
            </div>
          </div>
        ))}
        {jobsWithBids.map(j => {
          const pending = j.bids.filter(b => b.status === "pending").length
          return (
            <div key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#2B3441]">{j.title}</p>
                <p className="text-xs text-[#6B7280]">
                  {pending} new bid{pending !== 1 ? "s" : ""} waiting for your review
                </p>
              </div>
              <Link href="/jobs">
                <Button variant="outline" size="sm" className="h-7 border-[#2D7A5F] text-[#2D7A5F] text-xs">
                  Review bids
                </Button>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
