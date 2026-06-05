import { cn } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  escalated: "bg-red-100 text-red-700",
  under_review: "bg-blue-100 text-blue-700",
  resolved_customer: "bg-green-100 text-green-700",
  resolved_provider: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-purple-100 text-purple-700",
  disputed: "bg-red-100 text-red-700",
  payment_authorized: "bg-cyan-100 text-cyan-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", statusStyles[status] ?? "bg-gray-100 text-gray-600")}>
      {status.replace(/_/g, " ")}
    </span>
  )
}
