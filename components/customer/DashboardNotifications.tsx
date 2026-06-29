import Link from "next/link"
import { Bell } from "lucide-react"
import { getTranslations, getLocale } from "next-intl/server"
import { localizeNotification } from "@/lib/notifications/content"

const TYPE_ICON: Record<string, string> = {
  booking_confirmed:        "📅",
  booking_completed:        "✅",
  booking_cancelled:        "❌",
  booking_reminder:         "⏰",
  booking_rescheduled:      "🔄",
  booking_started:          "🧹",
  payment_received:         "💳",
  payout_processed:         "💰",
  bid_received:             "📬",
  bid_accepted:             "✅",
  bid_rejected:             "❌",
  new_job_request:          "📋",
  new_message:              "💬",
  review_received:          "⭐",
  dispute_opened:           "⚠️",
  dispute_resolved:         "✅",
  provider_approved:        "🎉",
  provider_rejected:        "❌",
  provider_suspended:       "⛔",
  identity_verified:        "✅",
  recurring_booking_created: "🔁",
}

type Notif = {
  id: string
  type: string
  title: string
  body: string
  metadata: Record<string, string> | null
  isRead: boolean
  createdAt: Date
  link: string | null
}

export async function DashboardNotifications({ notifications }: { notifications: Notif[] }) {
  const t = await getTranslations("compCustomerDashboardNotifications")
  const locale = await getLocale()
  const unread = notifications.filter(n => !n.isRead).length

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5EBF0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F4FAF6] px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-[#2B3441]">
          <Bell size={16} className="text-[#2D7A5F]" />
          {t("title")}
          {unread > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </h2>
        <Link href="/notifications" className="text-xs font-medium text-[#2D7A5F] hover:underline">
          {t("viewAll")}
        </Link>
      </div>

      {notifications.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#9CA3AF]">{t("empty")}</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {notifications.slice(0, 5).map(n => {
            const { title, body } = localizeNotification(n.type, locale, (n.metadata as Record<string, string> | null) ?? null, n.title, n.body)
            const rowClass = `flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#F4FAF6] ${!n.isRead ? "bg-[#F4FAF6]/60" : ""}`
            const inner = (
              <>
                <span className="mt-0.5 flex-shrink-0 text-base">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`truncate text-sm text-[#2B3441] ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                    {title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{body}</p>
                </div>
                {!n.isRead && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#2D7A5F]" />}
              </>
            )
            return n.link ? (
              <Link key={n.id} href={n.link} className={rowClass}>{inner}</Link>
            ) : (
              <div key={n.id} className={rowClass}>{inner}</div>
            )
          })}
        </div>
      )}

      <div className="border-t border-[#F4FAF6] px-5 py-3">
        <Link href="/notifications" className="text-xs font-medium text-[#6B7280] hover:text-[#2D7A5F] hover:underline transition-colors">
          {t("seeAll")}
        </Link>
      </div>
    </div>
  )
}
