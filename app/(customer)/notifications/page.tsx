export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import type { Metadata } from "next"
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton"

export const metadata: Metadata = { title: "Notifications — DORIX" }

const TYPE_ICON: Record<string, string> = {
  booking_confirmed: "📅", booking_completed: "✅", booking_cancelled: "❌",
  booking_reminder: "⏰", booking_rescheduled: "🔄", booking_started: "🧹",
  payment_received: "💳", payout_processed: "💰",
  bid_received: "📬", bid_accepted: "✅", bid_rejected: "❌",
  new_job_request: "📋", new_message: "💬", review_received: "⭐",
  dispute_opened: "⚠️", dispute_resolved: "✅", provider_approved: "🎉",
  identity_verified: "✅", recurring_booking_created: "🔁",
}

export default async function NotificationsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100)
    .catch(() => [] as typeof rows)

  const unreadCount = rows.filter(n => !n.isRead).length

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[#6B7280] mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[#E5EBF0] bg-white py-20 text-center shadow-sm">
          <p className="text-[#9CA3AF] text-sm">You have no notifications yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5EBF0] bg-white shadow-sm divide-y divide-gray-50">
          {rows.map(n => {
            const date = new Date(n.createdAt).toLocaleString("de-DE", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })
            const Wrapper = n.link ? "a" : "div" as React.ElementType
            return (
              <Wrapper
                key={n.id}
                {...(n.link ? { href: n.link } : {})}
                className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[#F4FAF6] ${n.link ? "cursor-pointer" : ""} ${!n.isRead ? "bg-[#F4FAF6]/50" : ""}`}
              >
                <span className="mt-0.5 flex-shrink-0 text-xl">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm text-[#2B3441] ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#2D7A5F]" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-[#6B7280] leading-relaxed">{n.body}</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">{date}</p>
                </div>
              </Wrapper>
            )
          })}
        </div>
      )}
    </div>
  )
}
