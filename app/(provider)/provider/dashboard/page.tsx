export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { bookings, providers, bids, notifications, payouts, reviews, disputes, jobPosts } from "@/lib/db/schema"
import { eq, desc, asc, and, sql, inArray } from "drizzle-orm"
import { findJobsNearProvider } from "@/lib/db/queries/geo"
import { CalendarDays, CheckCircle2, Star, TrendingUp, AlertCircle } from "lucide-react"
import { ProviderDashboardSchedule }     from "@/components/provider/ProviderDashboardSchedule"
import { ProviderDashboardBids }         from "@/components/provider/ProviderDashboardBids"
import { ProviderDashboardNotifications } from "@/components/provider/ProviderDashboardNotifications"
import { ProviderDashboardEarnings }     from "@/components/provider/ProviderDashboardEarnings"
import { ProviderDashboardNearbyJobs }   from "@/components/provider/ProviderDashboardNearbyJobs"
import { ProviderDashboardRating }       from "@/components/provider/ProviderDashboardRating"
import { ProviderDashboardDisputes }     from "@/components/provider/ProviderDashboardDisputes"
import { ReferralCard }                  from "@/components/referral/ReferralCard"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function ProviderDashboardPage() {
  const t = await getTranslations("providerProviderDashboardPage")
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
      latitude: providers.latitude,
      longitude: providers.longitude,
      serviceRadiusKm: providers.serviceRadiusKm,
      country: providers.country,
    })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) redirect("/provider/profile")

  const uid = userId as string
  const pid = provider.id

  const [
    upcomingBookings,
    recentBids,
    recentNotifs,
    recentPayouts,
    earningsRows,
    recentReviews,
    providerDisputes,
    nearbyJobs,
  ] = await Promise.all([
    // 1. Upcoming bookings
    db.query.bookings.findMany({
      where: (b, { and: a, inArray: inArr }) =>
        a(eq(b.providerId, pid), inArr(b.status, ["payment_authorized", "confirmed", "in_progress"])),
      with: {
        customer: { columns: { firstName: true, lastName: true } },
        service:  { columns: { name: true } },
      },
      orderBy: [asc(bookings.scheduledAt)],
      limit: 8,
    }).catch(() => [] as never[]),

    // 2. Recent bids with job post info
    db.query.bids.findMany({
      where: (b, { eq: eqFn }) => eqFn(b.providerId, pid),
      with: { jobPost: { columns: { title: true, status: true, serviceAddress: true } } },
      orderBy: [desc(bids.createdAt)],
      limit: 8,
    }).catch(() => [] as never[]),

    // 3. Recent notifications
    db.select()
      .from(notifications)
      .where(eq(notifications.userId, uid))
      .orderBy(desc(notifications.createdAt))
      .limit(5)
      .catch(() => [] as never[]),

    // 4. Recent payouts
    db.select()
      .from(payouts)
      .where(eq(payouts.providerId, pid))
      .orderBy(desc(payouts.createdAt))
      .limit(3)
      .catch(() => [] as never[]),

    // 5. Lifetime earnings aggregate
    db.select({ total: sql<number>`COALESCE(SUM(provider_payout), 0)` })
      .from(bookings)
      .where(and(eq(bookings.providerId, pid), eq(bookings.status, "completed")))
      .catch(() => [{ total: 0 }]),

    // 6. Recent reviews with customer name
    db.query.reviews.findMany({
      where: (r, { eq: eqFn }) => eqFn(r.providerId, pid),
      with: { customer: { columns: { firstName: true, lastName: true } } },
      orderBy: [desc(reviews.createdAt)],
      limit: 5,
    }).catch(() => [] as never[]),

    // 7. Disputes linked to this provider via bookings
    db.select({
      id: disputes.id,
      status: disputes.status,
      reason: disputes.reason,
      description: disputes.description,
      resolution: disputes.resolution,
      resolvedAt: disputes.resolvedAt,
      createdAt: disputes.createdAt,
    })
      .from(disputes)
      .innerJoin(bookings, eq(disputes.bookingId, bookings.id))
      .where(eq(bookings.providerId, pid))
      .orderBy(desc(disputes.createdAt))
      .limit(5)
      .catch(() => [] as never[]),

    // 8. Open job posts near the provider's location
    (async () => {
      if (!provider.latitude || !provider.longitude) return []
      const nearby = await findJobsNearProvider({
        latitude: provider.latitude,
        longitude: provider.longitude,
        radiusKm: provider.serviceRadiusKm ?? 25,
        limit: 6,
      }).catch(() => [])
      if (nearby.length === 0) return []
      const ids = nearby.map((r) => r.jobPostId)
      const jobs = await db.query.jobPosts.findMany({
        where: (jp, { and: a }) =>
          a(inArray(jp.id, ids), inArray(jp.status, ["open", "bidding"])),
        with: { category: { columns: { name: true } } },
      }).catch(() => [] as never[])
      return (jobs as typeof jobs).map((j) => ({
        ...j,
        distanceMeters: nearby.find((n) => n.jobPostId === j.id)?.distanceMeters ?? 0,
      }))
    })(),
  ])

  const totalEarnings = Number(earningsRows[0]?.total ?? 0)

  const [paidOutRow] = await db
    .select({ paid: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(payouts)
    .where(and(eq(payouts.providerId, pid), eq(payouts.status, "paid")))
    .catch(() => [{ paid: 0 }])
  const pendingPayout = Math.max(0, totalEarnings - Number(paidOutRow?.paid ?? 0))

  const unreadCount = recentNotifs.filter((n) => !n.isRead).length
  const activeDisputes = providerDisputes.filter((d) =>
    ["open", "under_review", "escalated"].includes(d.status)
  ).length

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{provider.businessName}</h1>
            <p className="text-[#6B7280] text-sm mt-1">{t("cleanerDashboard")}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!provider.isApproved && (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-700">
                <AlertCircle size={15} /> {t("pendingAdminApproval")}
              </div>
            )}
            {activeDisputes > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
                <AlertCircle size={15} /> {t("activeDisputes", { count: activeDisputes })}
              </div>
            )}
            <Link href="/provider/jobs">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white h-9 text-sm">
                {t("findJobs")}
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("totalEarned"),    value: totalEarnings > 0 ? `€${(totalEarnings / 100).toFixed(0)}` : "€0", icon: TrendingUp },
            { label: t("jobsCompleted"),  value: provider.totalJobsCompleted, icon: CheckCircle2 },
            { label: t("avgRating"),      value: provider.averageRating ? `${Number(provider.averageRating).toFixed(1)} ⭐` : "—", icon: Star },
            { label: t("upcoming"),       value: upcomingBookings.length, icon: CalendarDays },
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

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProviderDashboardNearbyJobs
            jobs={nearbyJobs as any}
            hasLocation={!!(provider.latitude && provider.longitude)}
            providerCountry={provider.country}
          />
          <ProviderDashboardSchedule bookings={upcomingBookings as any} />
          <ProviderDashboardRating
            overallRating={provider.averageRating}
            totalReviews={provider.totalReviews}
            reviews={recentReviews as any}
          />
          <ProviderDashboardBids bids={recentBids as any} />
          <ProviderDashboardEarnings
            totalEarnings={totalEarnings}
            pendingPayout={pendingPayout}
            recentPayouts={recentPayouts as any}
          />
          <ProviderDashboardNotifications notifications={recentNotifs as any} />
          <div className="lg:col-span-2">
            <ProviderDashboardDisputes disputes={providerDisputes as any} />
          </div>
          <div className="lg:col-span-2">
            <ReferralCard />
          </div>
        </div>

      </div>
    </div>
  )
}
