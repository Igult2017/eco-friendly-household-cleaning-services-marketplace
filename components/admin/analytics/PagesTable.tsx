import { FileText } from "lucide-react"
import type { UmamiMetric } from "@/lib/analytics/umami"

interface Props {
  pages: UmamiMetric[]
}

export function PagesTable({ pages }: Props) {
  const max = pages[0]?.y || 1

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <FileText className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="text-sm font-semibold text-[#2B3441]">Top Pages</h2>
        <span className="ml-auto text-xs text-[#6B7280]">Last 30 days</span>
      </div>
      {pages.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-[#6B7280]">No page data yet</p>
      ) : (
        <div className="overflow-x-auto -mx-px"><table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left px-6 py-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Page</th>
              <th className="text-right px-6 py-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pages.map(({ x: url, y: views }) => {
              const pct = Math.round((views / max) * 100)
              return (
                <tr key={url} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1 rounded-full bg-gray-100 overflow-hidden shrink-0">
                        <div className="h-full rounded-full bg-[#4CB87A]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-xs text-[#2B3441] truncate max-w-xs">{url || "/"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-2.5 text-right text-xs text-[#6B7280]">
                    {views.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      )}
    </div>
  )
}
