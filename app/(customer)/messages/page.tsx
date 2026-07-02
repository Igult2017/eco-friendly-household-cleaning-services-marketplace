export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { bookings, messages, providers, jobPosts } from "@/lib/db/schema"
import { eq, desc, and, isNotNull } from "drizzle-orm"
import { MessageSquare } from "lucide-react"

type Convo = { key: string; link: string; name: string; lastBody: string; lastAt: Date | string; unread: number }

export default async function CustomerMessagesPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("customerMessagesPage")

  // Recent messages on this client's bookings, joined to the cleaner. Grouped per booking in JS:
  // first row per booking (desc order) is the latest message; unread = cleaner messages not yet read.
  const rows = await db
    .select({
      bookingId: messages.bookingId,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      isRead: messages.isRead,
      businessName: providers.businessName,
    })
    .from(messages)
    .innerJoin(bookings, eq(messages.bookingId, bookings.id))
    .innerJoin(providers, eq(bookings.providerId, providers.id))
    .where(eq(bookings.customerId, userId))
    .orderBy(desc(messages.createdAt))
    .limit(500)
    .catch(() => [])

  // Job-level threads (accepted bids) — one per job, titled with the JOB's title.
  const jobRows = await db
    .select({ jobPostId: messages.jobPostId, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId, isRead: messages.isRead, title: jobPosts.title })
    .from(messages)
    .innerJoin(jobPosts, eq(messages.jobPostId, jobPosts.id))
    .where(and(eq(jobPosts.customerId, userId), isNotNull(messages.jobPostId)))
    .orderBy(desc(messages.createdAt))
    .limit(300)
    .catch(() => [])

  const map = new Map<string, Convo>()
  for (const m of rows) {
    if (!m.bookingId) continue
    const key = `b-${m.bookingId}`
    let c = map.get(key)
    if (!c) {
      c = { key, link: `/bookings/${m.bookingId}/messages`, name: m.businessName || t("cleaner"), lastBody: m.body, lastAt: m.createdAt, unread: 0 }
      map.set(key, c)
    }
    if (m.senderId !== userId && !m.isRead) c.unread++
  }
  for (const m of jobRows) {
    if (!m.jobPostId) continue
    const key = `j-${m.jobPostId}`
    let c = map.get(key)
    if (!c) {
      c = { key, link: `/jobs/${m.jobPostId}/messages`, name: m.title, lastBody: m.body, lastAt: m.createdAt, unread: 0 }
      map.set(key, c)
    }
    if (m.senderId !== userId && !m.isRead) c.unread++
  }
  const convos = [...map.values()].sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subheading")}</p>
      </div>

      {convos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-12 text-center">
          <MessageSquare size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-[#2B3441] mb-1">{t("emptyTitle")}</p>
          <p className="text-sm text-[#6B7280]">{t("emptyDescription")}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm divide-y divide-[#F0F4F8] overflow-hidden">
          {convos.map((c) => (
            <Link key={c.key} href={c.link} className="flex items-center gap-3 px-5 py-4 hover:bg-[#F4FAF6] transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2D7A5F]/10 text-[#2D7A5F] font-semibold">
                {(c.name[0] ?? "C").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#2B3441] truncate">{c.name}</p>
                  <span className="text-[11px] text-[#9CA3AF] shrink-0">{new Date(c.lastAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                </div>
                <p className={`text-sm truncate ${c.unread > 0 ? "text-[#2B3441] font-medium" : "text-[#6B7280]"}`}>{c.lastBody}</p>
              </div>
              {c.unread > 0 && (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2D7A5F] px-1.5 text-[11px] font-bold text-white">{c.unread}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
