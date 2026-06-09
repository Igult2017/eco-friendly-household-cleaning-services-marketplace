import { Share2 } from "lucide-react"

interface ReferrerRow {
  name: string
  visits: number
}

interface Props {
  referrers: ReferrerRow[]
}

const PLATFORM_COLOURS: Record<string, string> = {
  "Twitter / X":  "bg-sky-100 text-sky-700",
  "Facebook":     "bg-blue-100 text-blue-700",
  "Instagram":    "bg-pink-100 text-pink-700",
  "LinkedIn":     "bg-blue-100 text-blue-800",
  "YouTube":      "bg-red-100 text-red-700",
  "TikTok":       "bg-slate-100 text-slate-700",
  "Pinterest":    "bg-rose-100 text-rose-700",
  "Reddit":       "bg-orange-100 text-orange-700",
  "WhatsApp":     "bg-green-100 text-green-700",
  "Telegram":     "bg-cyan-100 text-cyan-700",
  "Direct":       "bg-gray-100 text-gray-600",
}

export function ReferrerTable({ referrers }: Props) {
  const total = referrers.reduce((s, r) => s + r.visits, 0) || 1

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Share2 className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="text-sm font-semibold text-[#2B3441]">Social Media & Referrers</h2>
        <span className="ml-auto text-xs text-[#6B7280]">Top 10</span>
      </div>
      {referrers.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-[#6B7280]">No referrer data yet</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {referrers.map(({ name, visits }) => {
            const pct = Math.round((visits / total) * 100)
            const chip = PLATFORM_COLOURS[name] ?? "bg-gray-100 text-gray-600"
            return (
              <li key={name} className="flex items-center gap-3 px-6 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${chip}`}>
                  {name}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#2D7A5F]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-[#6B7280] w-16 text-right shrink-0">
                  {visits.toLocaleString()} · {pct}%
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
