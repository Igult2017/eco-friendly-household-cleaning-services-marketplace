import { CalendarDays } from "lucide-react"

interface DowRow {
  name: string
  views: number
}

interface Props {
  data: DowRow[]
}

export function DayOfWeekBars({ data }: Props) {
  const max = Math.max(...data.map((d) => d.views), 1)

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <CalendarDays className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="text-sm font-semibold text-[#2B3441]">Traffic by Day of Week</h2>
        <span className="ml-auto text-xs text-[#6B7280]">Aggregated · 30 days</span>
      </div>
      <div className="flex items-end gap-2 px-6 py-6 h-44">
        {data.map(({ name, views }) => {
          const heightPct = Math.round((views / max) * 100)
          const isWeekend = name === "Sat" || name === "Sun"
          return (
            <div key={name} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-[#6B7280]">{views.toLocaleString()}</span>
              <div className="w-full flex items-end" style={{ height: "80px" }}>
                <div
                  className={`w-full rounded-t-md transition-all ${isWeekend ? "bg-[#4CB87A]/60" : "bg-[#2D7A5F]"}`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span className={`text-[11px] font-medium ${isWeekend ? "text-[#4CB87A]" : "text-[#6B7280]"}`}>{name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
