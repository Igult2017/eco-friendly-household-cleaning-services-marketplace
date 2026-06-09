export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, providers, bids, notifications, payouts } from "@/lib/db/schema"
import { eq, desc, asc, and, sql } from "drizzle-orm"
import { CalendarDays, CheckCircle2, Star, TrendingUp, AlertCircle } from "lucide-react"
import { ProviderDashboardSchedule } from "@/components/provider/ProviderDashboardSchedule"
import { ProviderDashboardBids } from "@/components/provider/ProviderDashboardBids"
import { ProviderDashboardNotifications } from "@/components/provider/ProviderDashboardNotifications"
import { ProviderDashboardEarnings } from "@/components/provider/ProviderDashboardEarnings"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function ProviderDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db
    .select({
      id: providers.id,
      businessName: providers.businessName,
      averageRating: providers.averageRating,
      totalReviews: providers.totalReviews,
      totalJobsCompleted: providers.totalJobsCompleted,
      isApproved: providers.isApproved,
      ecoLevel: providers.ecoLevel,
    })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) redirect("/onboarding/provider")

  const uid = userId as string

  const [upcomingBookings, recentBids, recentNotifs, recentPayouts, earningsRows] =
    await Promise.all([
      db.query.bookings.findMany({
        where: (b, { and: a, inArray: inArr }) =>
          a(eq(b.providerId, provider.id), inArr(b.status, ["payment_authorized", "confirmed", "in_progress"])),
        with: {
          customer: { columns: { firstName: true, lastName: true } },
          service:  { columns: { name: true } },
        },
        orderBy: [asc(bookings.scheduledAt)],
        limit: 8,
      }).catch(() => [] as never[]),

      db.query.bids.findMany({
        where: (b, { eq: eqFn }) => eqFn(b.providerId, provider.id),
        with: { jobPost: { columns: { title: true, status: true, serviceAddress: true } } },
        orderBy: [desc(bids.createdAt)],
        limit: 8,
      }).catch(() => [] as never[]),

      db.select()
        .from(notifications)
        .where(eq(notifications.userId, uid))
        .orderBy(desc(notifications.createdAt))
        .limit(5)
        .catch(() => [] as never[]),

      db.select()
        .from(payouts)
        .where(eq(payouts.providerId, provider.id))
        .orderBy(desc(payouts.createdAt))
        .limit(3)
        .catch(() => [] as never[]),

      // total lifetime earnings + total already paid out (two aggregates, one query each)
      db.select({ total: sql<number>`COALESCE(SUM(provider_payout), 0)` })
        .from(bookings)
        .where(and(eq(bookings.providerId, provider.id), eq(bookings.status, "completed")))
        .catch(() => [{ total: 0 }]),
    ])

  const totalEarnings = Number(earningsRows[0]?.total ?? 0)

  // Pending payout = completed bookings earnings minus sum of all paid-out amounts
  const [paidOutRow] = await db
    .select({ paid: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(payouts)
    .where(and(eq(payouts.providerId, provider.id), eq(payouts.status, "paid")))
    .catch(() => [{ paid: 0 }])
  const pendingPayout = Math.max(0, totalEarnings - Number(paidOutRow?.paid ?? 0))

  const unreadCount = recentNotifs.filter((n) => !n.isRead).length

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{provider.businessName}</h1>
            <p className="text-[#6B7280] text-sm mt-1">Cleaner Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {!provider.isApproved && (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-700">
                <AlertCircle size={15} /> Pending admin approval
              </div>
            )}
            <Link href="/provider/jobs">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white h-9 text-sm">
                Find jobs
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Earned",  value: totalEarnings > 0 ? `€${(totalEarnings / 100).toFixed(0)}` : "€0", icon: TrendingUp },
            { label: "Jobs Completed", value: provider.totalJobsCompleted, icon: CheckCircle2 },
            { label: "Avg Rating",    value: provider.averageRating ? `${Number(provider.averageRating).toFixed(1)} ⭐` : "—", icon: Star },
            { label: "Upcoming",      value: upcomingBookings.length, icon: CalendarDays },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EBF0]">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={15} className="text-[#2D7A5F]" />
                <span className="text-xs text-[#6B7280] font-medium">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-[#2B3441]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProviderDashboardSchedule bookings={upcomingBookings as any} />
          <ProviderDashboardBids bids={recentBids as any} />
          <ProviderDashboardEarnings
            totalEarnings={totalEarnings}
            pendingPayout={pendingPayout}
            recentPayouts={recentPayouts as any}
          />
          <ProviderDashboardNotifications notifications={recentNotifs as any} />
        </div>

      </div>
    </div>
  )
}
