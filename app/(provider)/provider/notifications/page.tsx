export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { notifications, providers } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import Link from "next/link"
import { Bell, Briefcase, CheckCircle2, DollarSign, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTranslations, getLocale } from "next-intl/server"
import { localizeNotification } from "@/lib/notifications/content"

const TYPE_ICON: Record<string, React.ElementType> = {
  new_job_request:   Briefcase,
  booking_confirmed: CheckCircle2,
  booking_completed: CheckCircle2,
  payment_received:  DollarSign,
  payout_processed:  DollarSign,
  dispute_opened:    AlertTriangle,
  bid_accepted:      CheckCircle2,
  bid_rejected:      AlertTriangle,
  provider_approved: CheckCircle2,
}

function timeAgo(d: Date | string, t: (key: string, values?: Record<string, string | number | Date>) => string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t("timeAgoMinutes", { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t("timeAgoHours", { count: hrs })
  return t("timeAgoDays", { count: Math.floor(hrs / 24) })
}

export default async function ProviderNotificationsPage() {
  const t = await getTranslations("providerProviderNotificationsPage")
  const locale = await getLocale()
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/profile")

  const notifs = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  const unread = notifs.filter((n) => !n.isRead).length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441] flex items-center gap-2">
            <Bell size={22} className="text-[#2D7A5F]" /> {t("heading")}
          </h1>
          {unread > 0 && (
            <p className="text-sm text-[#6B7280] mt-0.5">{t("unreadCount", { count: unread })}</p>
          )}
        </div>
      </div>

      {notifs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5EBF0] p-12 text-center">
          <Bell size={40} className="mx-auto text-[#9CA3AF] mb-3" />
          <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
          <p className="text-sm text-[#6B7280]">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden divide-y divide-[#F0F4F8]">
          {notifs.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Info
            const { title, body } = localizeNotification(
              n.type,
              locale,
              (n.metadata as Record<string, string> | null) ?? null,
              n.title,
              n.body,
            )
            const inner = (
              <div className={cn("flex items-start gap-3 px-5 py-4", !n.isRead && "bg-[#F4FAF6]")}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className="w-9 h-9 rounded-full bg-[#EDF5F0] flex items-center justify-center">
                    <Icon size={15} className="text-[#2D7A5F]" />
                  </div>
                  {!n.isRead && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#2B3441]">{title}</p>
                  <p className="text-xs text-[#6B7280] leading-snug mt-0.5">{body}</p>
                </div>
                <span className="text-xs text-[#9CA3AF] flex-shrink-0">{timeAgo(n.createdAt, t)}</span>
              </div>
            )
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-[#F8FAFB] transition-colors">{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
