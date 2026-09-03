import Link from "next/link"
import { getOverviewData, pctChange, type Delta } from "@/lib/admin/overview"
import { getAnalytics } from "@/lib/analytics/umami"
import { KpiCard } from "@/components/admin/KpiCard"
import { GrowthTimeline } from "@/components/admin/overview/GrowthTimeline"
import { FunnelStrip } from "@/components/admin/overview/FunnelStrip"
import { Users, CalendarCheck, Euro, MailOpen, LayoutDashboard } from "lucide-react"

export const dynamic = "force-dynamic"

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
]

function trend(d: Delta): string {
  const p = pctChange(d)
  if (p === null) return "no earlier data to compare"
  const arrow = p > 0 ? "▲" : p < 0 ? "▼" : "→"
  return `${arrow} ${Math.abs(p)}% vs previous period`
}

const euros = (cents: number) => `€${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const days = RANGES.some((r) => String(r.days) === sp.days) ? Number(sp.days) : 30

  // Traffic lives in Umami and everything else in our own database — this page is the only place
  // the two are put on the same axis.
  const [data, analytics] = await Promise.all([getOverviewData(days), getAnalytics("day")])

  const hasTraffic = analytics.configured && !!analytics.pageviews
  const visitorsByDay = new Map(
    (analytics.pageviews?.sessions ?? []).map((p) => [String(p.x).slice(0, 10), Number(p.y)]),
  )
  const series = data.series.map((d) => ({ ...d, visitors: visitorsByDay.get(d.date) ?? 0 }))
  const visitorsTotal = series.reduce((a, d) => a + d.visitors, 0)

  const kpis = [
    { label: "Visitors", value: hasTraffic ? visitorsTotal.toLocaleString() : "—",
      sub: hasTraffic ? `over ${days} days` : "Umami not configured", icon: Users, accent: "blue" as const },
    { label: "New signups", value: data.totals.signups.value.toLocaleString(),
      sub: trend(data.totals.signups), icon: Users, accent: "purple" as const },
    { label: "Bookings", value: data.totals.bookings.value.toLocaleString(),
      sub: trend(data.totals.bookings), icon: CalendarCheck, accent: "green" as const },
    { label: "Revenue", value: euros(data.totals.revenue.value),
      sub: trend(data.totals.revenue), icon: Euro, accent: "green" as const },
  ]

  const openRate = data.email.sent > 0 ? Math.round((data.email.opened / data.email.sent) * 100) : null

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
            <LayoutDashboard size={18} className="text-[#2D7A5F]" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Overview</h1>
            <p className="text-sm text-[#6B7280]">Traffic, signups, bookings, revenue and email in one place.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/admin/overview?days=${r.days}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                r.days === days ? "bg-[#2D7A5F] text-white" : "text-[#6B7280] hover:bg-gray-50"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <GrowthTimeline series={series} markers={data.markers} hasTraffic={hasTraffic} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelStrip
          visitors={visitorsTotal}
          signups={data.totals.signups.value}
          booked={data.funnel.booked}
          repeat={data.funnel.repeat}
          hasTraffic={hasTraffic}
        />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-[#2B3441]">Email in this period</h2>
            <Link href="/admin/marketing" className="text-sm font-medium text-[#2D7A5F] hover:underline">Campaigns</Link>
          </div>

          {data.email.sent === 0 ? (
            <div className="mt-6 text-center py-8">
              <MailOpen size={28} className="mx-auto text-[#9CA3AF]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-[#2B3441]">No emails went out in this period</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Campaigns you send will appear here, and as markers on the timeline above.
              </p>
              <Link href="/admin/marketing"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold px-4 py-2 transition-all duration-200">
                Write a campaign
              </Link>
            </div>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-4">
              {[
                { k: "Sent", v: data.email.sent.toLocaleString() },
                { k: "Opened", v: `${data.email.opened.toLocaleString()}${openRate !== null ? ` (${openRate}%)` : ""}` },
                { k: "Clicked", v: data.email.clicked.toLocaleString() },
                { k: "Bounced / spam", v: data.email.bad.toLocaleString() },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-xs text-[#6B7280]">{k}</dt>
                  <dd className="text-lg font-semibold text-[#2B3441] tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
