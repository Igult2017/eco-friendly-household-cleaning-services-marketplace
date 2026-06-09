import Link from "next/link"
import { Briefcase, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/formatCurrency"

const STATUS_COLOR: Record<string, string> = {
  open:      "bg-blue-100 text-blue-700",
  bidding:   "bg-[#D1F0E0] text-[#2D7A5F]",
  assigned:  "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  expired:   "bg-gray-100 text-gray-500",
}

type Job = {
  id: string
  title: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  bids: Array<{ status: string }>
  category: { name: string } | null
}

export function DashboardJobs({ jobs }: { jobs: Job[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5EBF0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F4FAF6] px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-[#2B3441]">
          <Briefcase size={16} className="text-[#2D7A5F]" /> Job Posts
        </h2>
        <Link href="/jobs" className="text-xs font-medium text-[#2D7A5F] hover:underline">
          View all →
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[#9CA3AF] mb-3">No jobs posted yet</p>
          <Link href="/post-job" className="text-xs font-semibold text-[#2D7A5F] hover:underline">
            Post a job and let cleaners bid →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {jobs.map(j => {
            const pendingBids = j.bids.filter(b => b.status === "pending").length
            const totalBids = j.bids.length
            return (
              <Link
                key={j.id}
                href="/jobs"
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#F4FAF6]"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#2B3441]">{j.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-[#9CA3AF]">
                      {totalBids} bid{totalBids !== 1 ? "s" : ""}
                    </span>
                    {pendingBids > 0 && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                        {pendingBids} new
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {j.budgetMin != null && j.budgetMax != null && (
                    <p className="text-xs font-bold text-[#2B3441]">
                      {formatCurrency(j.budgetMin)}–{formatCurrency(j.budgetMax)}
                    </p>
                  )}
                  <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_COLOR[j.status] ?? "bg-gray-100 text-gray-500")}>
                    {j.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="border-t border-[#F4FAF6] px-5 py-3">
        <Link href="/post-job" className="flex items-center gap-1 text-xs font-medium text-[#2D7A5F] hover:underline">
          <Plus size={11} /> Post a new job
        </Link>
      </div>
    </div>
  )
}
