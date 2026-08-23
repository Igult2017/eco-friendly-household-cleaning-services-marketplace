import Link from "next/link"
import {
  getAnalytics,
  classifyReferrers,
  computeDayOfWeek,
  computeTrendSeries,
  type AnalyticsRange,
} from "@/lib/analytics/umami"
import { KpiCard } from "@/components/admin/KpiCard"
import { CountryTable } from "@/components/admin/analytics/CountryTable"
import { ReferrerTable } from "@/components/admin/analytics/ReferrerTable"
import { PagesTable } from "@/components/admin/analytics/PagesTable"
import { DayOfWeekBars } from "@/components/admin/analytics/DayOfWeekBars"
import { TrafficTrendChart } from "@/components/admin/analytics/TrafficTrendChart"
import { UmamiSetup } from "@/components/admin/analytics/UmamiSetup"
import { BarChart3, Users, MousePointerClick, Clock } from "lucide-react"

const VALID_RANGES: AnalyticsRange[] = ["day", "week", "month"]
const RANGE_LABELS: Record<AnalyticsRange, string> = {
  day: "Last 30 days",
  week: "Last 90 days",
  month: "Last 12 months",
}
const RANGE_TABS: { key: AnalyticsRange; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
]

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const range: AnalyticsRange = VALID_RANGES.includes(sp.range as AnalyticsRange)
    ? (sp.range as AnalyticsRange)
    : "day"
  const { configured, stats, countries, referrers, pages, pageviews } = await getAnalytics(range)

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

  const windowLabel = RANGE_LABELS[range]
  const dowData = pageviews ? computeDayOfWeek(pageviews.pageviews) : []
  const trendData = pageviews ? computeTrendSeries(range, pageviews.pageviews) : []
  const socialData = referrers ? classifyReferrers(referrers) : []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Traffic Analytics</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Powered by Umami · {windowLabel} · GDPR-safe</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {RANGE_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "day" ? "/admin/analytics" : `/admin/analytics?range=${tab.key}`}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                range === tab.key ? "bg-[#2D7A5F] text-white" : "text-[#6B7280] hover:text-[#2B3441]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
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

      <TrafficTrendChart data={trendData} windowLabel={windowLabel} />

      <DayOfWeekBars data={dowData} windowLabel={windowLabel} />

      <PagesTable pages={pages ?? []} windowLabel={windowLabel} />
    </div>
  )
}
