import { getAnalytics, classifyReferrers, computeDayOfWeek } from "@/lib/analytics/umami"
import { KpiCard } from "@/components/admin/KpiCard"
import { CountryTable } from "@/components/admin/analytics/CountryTable"
import { ReferrerTable } from "@/components/admin/analytics/ReferrerTable"
import { PagesTable } from "@/components/admin/analytics/PagesTable"
import { DayOfWeekBars } from "@/components/admin/analytics/DayOfWeekBars"
import { UmamiSetup } from "@/components/admin/analytics/UmamiSetup"
import { BarChart3, Users, MousePointerClick, Clock } from "lucide-react"

export default async function AdminAnalyticsPage() {
  const { configured, stats, countries, referrers, pages, pageviews } = await getAnalytics()

  if (!configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Traffic Analytics</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Self-hosted Umami · GDPR compliant · No cookies</p>
        </div>
        <UmamiSetup />
      </div>
    )
  }

  const bounceRate = stats
    ? Math.round((stats.bounces.value / (stats.visits.value || 1)) * 100)
    : 0
  const avgMinutes = stats
    ? Math.round(stats.totaltime.value / (stats.visits.value || 1) / 60)
    : 0

  const dowData = pageviews ? computeDayOfWeek(pageviews.pageviews) : []
  const socialData = referrers ? classifyReferrers(referrers) : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Traffic Analytics</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Powered by Umami · Last 30 days · GDPR-safe</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Page Views"
          value={(stats?.pageviews.value ?? 0).toLocaleString()}
          sub={`${stats?.pageviews.prev.toLocaleString() ?? 0} prev period`}
          icon={BarChart3}
          accent="green"
        />
        <KpiCard
          label="Unique Visitors"
          value={(stats?.visitors.value ?? 0).toLocaleString()}
          sub={`${stats?.visitors.prev.toLocaleString() ?? 0} prev period`}
          icon={Users}
          accent="blue"
        />
        <KpiCard
          label="Bounce Rate"
          value={`${bounceRate}%`}
          sub="Single-page sessions"
          icon={MousePointerClick}
          accent="amber"
        />
        <KpiCard
          label="Avg. Session"
          value={`${avgMinutes}m`}
          sub="Per visit"
          icon={Clock}
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CountryTable countries={countries ?? []} />
        <ReferrerTable referrers={socialData} />
      </div>

      <DayOfWeekBars data={dowData} />

      <PagesTable pages={pages ?? []} />
    </div>
  )
}
