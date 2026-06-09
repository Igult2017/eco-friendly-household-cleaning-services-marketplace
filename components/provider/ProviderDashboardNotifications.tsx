import Link from "next/link"
import { Bell, Briefcase, CheckCircle2, DollarSign, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

const TYPE_ICON: Record<string, React.ElementType> = {
  new_job_request:  Briefcase,
  booking_confirmed: CheckCircle2,
  booking_completed: CheckCircle2,
  payment_received:  DollarSign,
  payout_processed:  DollarSign,
  dispute_opened:    AlertTriangle,
  bid_accepted:      CheckCircle2,
  bid_rejected:      AlertTriangle,
  provider_approved: CheckCircle2,
}

type Notif = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: Date | string
}

export function ProviderDashboardNotifications({ notifications }: { notifications: Notif[] }) {
  const unread = notifications.filter((n) => !n.isRead).length

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <Bell size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">No notifications</p>
        <p className="text-sm text-[#6B7280]">New job alerts and updates will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <Bell size={16} className="text-[#2D7A5F]" /> Notifications
          {unread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unread}
            </span>
          )}
        </h2>
        <Link href="/provider/notifications" className="text-xs text-[#2D7A5F] hover:underline">View all →</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {notifications.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Info
          const rowClass = cn(
            "flex items-start gap-3 px-5 py-3 transition-colors",
            !n.isRead ? "bg-[#F4FAF6]" : "bg-white hover:bg-gray-50"
          )
          const inner = (
            <>
              <div className="relative flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-[#EDF5F0] flex items-center justify-center">
                  <Icon size={14} className="text-[#2D7A5F]" />
                </div>
                {!n.isRead && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#2B3441]">{n.title}</p>
                <p className="text-xs text-[#6B7280] leading-snug line-clamp-2">{n.body}</p>
              </div>
            </>
          )
          return n.link ? (
            <Link key={n.id} href={n.link} className={rowClass}>{inner}</Link>
          ) : (
            <div key={n.id} className={rowClass}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
