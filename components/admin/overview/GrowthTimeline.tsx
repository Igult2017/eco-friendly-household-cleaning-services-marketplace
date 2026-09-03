import type { CampaignMarker, DayPoint } from "@/lib/admin/overview"

// Visitors, bookings and campaign sends drawn against ONE date axis. That shared axis is the entire
// point of this chart: with traffic on /admin/analytics and campaigns on /admin/marketing there was
// no way to see whether sending an email moved anything.
//
// Drawn as inline SVG rather than a chart library — two series and some markers don't justify
// shipping a charting bundle, and this renders on the server with no client JavaScript at all.
export function GrowthTimeline({
  series,
  markers,
  hasTraffic,
}: {
  series: DayPoint[]
  markers: CampaignMarker[]
  hasTraffic: boolean
}) {
  const W = 960
  const H = 220
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxVisitors = Math.max(1, ...series.map((d) => d.visitors))
  const maxBookings = Math.max(1, ...series.map((d) => d.bookings))
  const x = (i: number) => PAD.left + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW)
  const yV = (v: number) => PAD.top + plotH - (v / maxVisitors) * plotH
  const yB = (v: number) => PAD.top + plotH - (v / maxBookings) * plotH

  const visitorLine = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yV(d.visitors).toFixed(1)}`).join(" ")
  const visitorArea = `${visitorLine} L${x(series.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`

  const indexOf = (date: string) => series.findIndex((d) => d.date === date)
  const ticks = series.filter((_, i) => i % Math.ceil(series.length / 6) === 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-semibold text-[#2B3441]">Traffic, bookings and campaigns on one timeline</h2>
        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#2563EB]" />Visitors</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#2D7A5F]" />Bookings</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#7C3AED]" />Campaign sent</span>
        </div>
      </div>
      <p className="text-xs text-[#6B7280] mb-3">
        {hasTraffic
          ? "A campaign that worked shows a bump in the days after its marker."
          : "Visitor data needs Umami configured — bookings and campaigns are shown regardless."}
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] h-[220px]" role="img"
          aria-label="Daily visitors and bookings over the selected period, with markers where email campaigns were sent">
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH * f} y2={PAD.top + plotH * f}
              stroke="#E5E7EB" strokeWidth="1" strokeDasharray={f === 1 ? "0" : "3 3"} />
          ))}

          <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" className="fill-[#9CA3AF]" fontSize="10">{maxVisitors}</text>
          <text x={PAD.left - 6} y={PAD.top + plotH} textAnchor="end" className="fill-[#9CA3AF]" fontSize="10">0</text>

          {hasTraffic && <path d={visitorArea} fill="#2563EB" fillOpacity="0.08" />}
          {hasTraffic && <path d={visitorLine} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />}

          {series.map((d, i) =>
            d.bookings > 0 ? (
              <circle key={d.date} cx={x(i)} cy={yB(d.bookings)} r="3.5" fill="#2D7A5F">
                <title>{`${d.date}: ${d.bookings} booking${d.bookings === 1 ? "" : "s"}`}</title>
              </circle>
            ) : null,
          )}

          {markers.map((m, k) => {
            const i = indexOf(m.date)
            if (i < 0) return null
            return (
              <g key={`${m.date}-${k}`}>
                <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + plotH} stroke="#7C3AED" strokeWidth="1" strokeDasharray="4 3" />
                <circle cx={x(i)} cy={PAD.top} r="4" fill="#7C3AED">
                  <title>{`${m.name} — sent to ${m.recipients} on ${m.date}`}</title>
                </circle>
              </g>
            )
          })}

          {ticks.map((d) => (
            <text key={d.date} x={x(indexOf(d.date))} y={H - 8} textAnchor="middle" className="fill-[#9CA3AF]" fontSize="10">
              {d.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>

      {markers.length === 0 && (
        <p className="mt-3 text-xs text-[#6B7280]">
          No campaigns were sent in this period, so there is nothing to correlate traffic against yet.
        </p>
      )}
    </div>
  )
}
