import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  open:               { label: "Open",             cls: "bg-red-100 text-red-700" },
  under_review:       { label: "Under review",     cls: "bg-amber-100 text-amber-700" },
  escalated:          { label: "Escalated",        cls: "bg-red-100 text-red-700" },
  resolved_customer:  { label: "Customer won",     cls: "bg-orange-100 text-orange-700" },
  resolved_provider:  { label: "Resolved in your favour", cls: "bg-green-100 text-green-700" },
  closed:             { label: "Closed",           cls: "bg-gray-100 text-gray-500" },
}

type DisputeRow = {
  id: string
  status: string
  reason: string
  description: string
  resolution: string | null
  resolvedAt: Date | string | null
  createdAt: Date | string
}

function formatShort(d: Date | string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function ProviderDashboardDisputes({ disputes }: { disputes: DisputeRow[] }) {
  const activeCount = disputes.filter((d) => ["open", "under_review", "escalated"].includes(d.status)).length

  if (disputes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <ShieldCheck size={36} className="mx-auto text-[#2D7A5F] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">No disputes — great work!</p>
        <p className="text-sm text-[#6B7280]">A clean dispute record builds trust with customers.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <AlertTriangle size={16} className={activeCount > 0 ? "text-red-500" : "text-[#9CA3AF]"} />
          Dispute History
          {activeCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </h2>
        <Link href="/provider/bookings" className="text-xs text-[#2D7A5F] hover:underline">Bookings →</Link>
      </div>

      <div className="divide-y divide-[#F0F4F8]">
        {disputes.map((d) => {
          const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.closed
          const isActive = ["open", "under_review", "escalated"].includes(d.status)
          return (
            <div key={d.id} className={cn("px-5 py-4", isActive && "bg-red-50/40")}>
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-sm font-medium text-[#2B3441]">{d.reason}</p>
                <Badge className={cn("text-xs flex-shrink-0", cfg.cls)}>{cfg.label}</Badge>
              </div>
              <p className="text-xs text-[#6B7280] line-clamp-2 mb-1">{d.description}</p>
              {d.resolution && (
                <p className="text-xs text-[#2D7A5F] font-medium">Resolution: {d.resolution}</p>
              )}
              <p className="text-xs text-[#9CA3AF] mt-1">
                Opened {formatShort(d.createdAt)}
                {d.resolvedAt ? ` · Resolved ${formatShort(d.resolvedAt)}` : ""}
              </p>
            </div>
          )
        })}
      </div>

      {activeCount === 0 && disputes.length > 0 && (
        <div className="px-5 py-3 bg-[#F4FAF6] text-xs text-[#2D7A5F] font-medium flex items-center gap-1.5">
          <ShieldCheck size={12} /> All disputes resolved
        </div>
      )}
    </div>
  )
}
