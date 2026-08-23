import { TrendingUp } from "lucide-react"

interface TrendRow {
  name: string
  views: number
}

interface Props {
  data: TrendRow[]
  windowLabel: string
}

export function TrafficTrendChart({ data, windowLabel }: Props) {
  const max = Math.max(...data.map((d) => d.views), 1)

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <TrendingUp className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="text-sm font-semibold text-[#2B3441]">Visits Over Time</h2>
        <span className="ml-auto text-xs text-[#6B7280]">{windowLabel}</span>
      </div>
      {data.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-[#6B7280]">No traffic data yet</p>
      ) : (
        <div className="overflow-x-auto px-6 py-6">
          <div className="flex items-end gap-2 h-44" style={{ minWidth: `${data.length * 36}px` }}>
            {data.map(({ name, views }) => {
              const heightPct = Math.round((views / max) * 100)
              return (
                <div key={name} className="flex-1 flex flex-col items-center gap-1 min-w-[28px]">
                  <span className="text-[10px] text-[#6B7280]">{views.toLocaleString()}</span>
                  <div className="w-full flex items-end" style={{ height: "80px" }}>
                    <div
                      className="w-full rounded-t-md bg-[#2D7A5F] transition-all"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#6B7280] whitespace-nowrap">{name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
