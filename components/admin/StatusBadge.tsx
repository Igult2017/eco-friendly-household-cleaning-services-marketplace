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
  pending_capture: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-purple-100 text-purple-700",
  disputed: "bg-red-100 text-red-700",
  payment_authorized: "bg-cyan-100 text-cyan-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  client_no_show: "bg-orange-100 text-orange-700",
  cleaner_no_show: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  authorized: "bg-cyan-100 text-cyan-700",
}

// Plain words for the states whose internal name explains nothing. Without these the badge printed
// the raw database value — "Pending Capture" meant nothing to anyone reading the dashboard, and it
// was read as something an admin had to go and finish by hand. Anything not listed here falls back
// to the old underscores-to-spaces treatment, which is fine for self-explanatory states.
export const statusLabels: Record<string, string> = {
  pending_capture: "Work done — awaiting confirmation",
  payment_authorized: "Card held — not yet charged",
  pending_payment: "Awaiting payment",
  in_progress: "Cleaning under way",
  client_no_show: "Client didn't show",
  cleaner_no_show: "Cleaner didn't show",
  under_review: "Under review",
  resolved_customer: "Resolved for the client",
  resolved_provider: "Resolved for the cleaner",
}

// The "why" behind the ones people ask about, shown on hover.
const statusHints: Record<string, string> = {
  pending_capture:
    "The cleaner has marked the job done. The client's card is still only on hold — the money is taken automatically once both sides confirm, or when an admin releases it. Nothing is stuck.",
  payment_authorized:
    "The client's card has been checked and the amount reserved, but no money has moved yet. It is taken when the job is finished and confirmed.",
}

export function StatusBadge({ status }: { status: string }) {
  const label = statusLabels[status] ?? status.replace(/_/g, " ")
  const hint = statusHints[status]
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        // Only the fallback needs capitalising — the written-out labels are already sentence case.
        statusLabels[status] ? "" : "capitalize",
        hint && "cursor-help",
        statusStyles[status] ?? "bg-gray-100 text-gray-600",
      )}
    >
      {label}
    </span>
  )
}
