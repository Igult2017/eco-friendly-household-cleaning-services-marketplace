export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, getLocale } from "next-intl/server"
import { localizeNotification } from "@/lib/notifications/content"
import { PingUnread } from "@/components/notifications/PingUnread"

export const metadata: Metadata = { title: "Notifications — DORIXÉ" }

const TYPE_ICON: Record<string, string> = {
  booking_confirmed: "📅", booking_completed: "✅", booking_cancelled: "❌",
  booking_reminder: "⏰", booking_rescheduled: "🔄", booking_started: "🧹",
  payment_received: "💳", payout_processed: "💰",
  bid_received: "📬", bid_accepted: "✅", bid_rejected: "❌",
  new_job_request: "📋", new_message: "💬", review_received: "⭐",
  dispute_opened: "⚠️", dispute_resolved: "✅", provider_approved: "🎉",
  identity_verified: "✅", recurring_booking_created: "🔁",
}

type Row = typeof notifications.$inferSelect

export default async function NotificationsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const t = await getTranslations("customerNotificationsPage")
  const locale = await getLocale()

  let rows: Row[] = []
  try {
    rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100)
  } catch { /* DB unavailable — show empty state */ }

  const unreadCount = rows.filter(n => !n.isRead).length

  // Opening the notification centre IS reading it: everything is marked read (the list below was
  // snapshotted first, so the unread highlighting still shows this once) and badges clear instantly.
  if (unreadCount > 0) {
    try {
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    } catch { /* badges clear on the next poll */ }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {unreadCount > 0 && <PingUnread />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{t("heading")}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[#6B7280] mt-1">{t("unreadCount", { count: unreadCount })}</p>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[#E5EBF0] bg-white py-20 text-center shadow-sm">
          <p className="text-[#9CA3AF] text-sm">{t("emptyState")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5EBF0] bg-white shadow-sm divide-y divide-gray-50">
          {rows.map(n => {
            const date = new Date(n.createdAt).toLocaleString("de-DE", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })
            const rowClass = `flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[#F4FAF6] ${!n.isRead ? "bg-[#F4FAF6]/50" : ""}`
            const { title, body } = localizeNotification(
              n.type,
              locale,
              (n.metadata as Record<string, string> | null) ?? null,
              n.title,
              n.body,
            )
            const inner = (
              <>
                <span className="mt-0.5 flex-shrink-0 text-xl">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm text-[#2B3441] ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                      {title}
                    </p>
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#2D7A5F]" />}
                  </div>
                  <p className="mt-0.5 text-sm text-[#6B7280] leading-relaxed">{body}</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">{date}</p>
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
      )}
    </div>
  )
}
