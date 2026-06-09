import { countryName, type UmamiMetric } from "@/lib/analytics/umami"
import { Globe } from "lucide-react"

interface Props {
  countries: UmamiMetric[]
}

export function CountryTable({ countries }: Props) {
  const total = countries.reduce((s, c) => s + c.y, 0) || 1

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Globe className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="text-sm font-semibold text-[#2B3441]">Traffic by Country</h2>
        <span className="ml-auto text-xs text-[#6B7280]">Last 30 days</span>
      </div>
      {countries.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-[#6B7280]">No data yet</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {countries.map(({ x: code, y: visits }) => {
            const pct = Math.round((visits / total) * 100)
            return (
              <li key={code} className="flex items-center gap-3 px-6 py-3">
                <span className="text-lg leading-none">{flagEmoji(code)}</span>
                <span className="flex-1 text-sm text-[#2B3441] truncate">{countryName(code)}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#4CB87A]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[#6B7280] w-12 text-right">{visits.toLocaleString()}</span>
                  <span className="text-xs text-[#6B7280] w-8 text-right">{pct}%</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Regional Indicator Symbol letters are at U+1F1E6 (A) through U+1F1FF (Z)
function flagEmoji(code: string) {
  if (!code || code.length !== 2) return "🌐"
  const offset = 127397 // 0x1F1E6 - 65
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset))
}
