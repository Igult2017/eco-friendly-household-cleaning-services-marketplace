// Where people fall out, in order: visited → signed up → booked once → came back.
// Splitting these across three pages hid the only question that matters — which step is leaking.
export function FunnelStrip({
  visitors,
  signups,
  booked,
  repeat,
  hasTraffic,
}: {
  visitors: number
  signups: number
  booked: number
  repeat: number
  hasTraffic: boolean
}) {
  const steps = [
    { label: "Visitors", note: "in this period", value: hasTraffic ? visitors : null, of: null as number | null },
    { label: "Signed up", note: "in this period", value: signups, of: hasTraffic ? visitors : null },
    { label: "Booked at least once", note: "all time", value: booked, of: null },
    { label: "Booked again", note: "all time", value: repeat, of: booked },
  ]

  const widest = Math.max(1, ...steps.map((s) => s.value ?? 0))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-[#2B3441]">Where people drop off</h2>
      <p className="text-xs text-[#6B7280] mt-1 mb-4">
        The first two steps cover the selected period. The booking steps are all-time, because a
        client who signed up months ago and books today is still the same journey.
      </p>

      <ul className="space-y-3">
        {steps.map((s) => {
          const pct = s.of && s.of > 0 && s.value !== null ? Math.round((s.value / s.of) * 100) : null
          const width = s.value === null ? 0 : Math.max(2, ((s.value ?? 0) / widest) * 100)
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-sm font-medium text-[#2B3441]">
                  {s.label} <span className="font-normal text-[#9CA3AF] text-xs">· {s.note}</span>
                </span>
                <span className="text-sm font-semibold text-[#2B3441] tabular-nums">
                  {s.value === null ? "—" : s.value.toLocaleString()}
                  {pct !== null && <span className="ml-2 text-xs font-normal text-[#6B7280]">{pct}% of previous</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-[#2D7A5F] transition-all duration-200" style={{ width: `${width}%` }} />
              </div>
            </li>
          )
        })}
      </ul>

      {!hasTraffic && (
        <p className="mt-4 text-xs text-[#6B7280]">
          Visitor numbers need Umami configured, so the first conversion rate can&apos;t be worked out yet.
        </p>
      )}
    </div>
  )
}
