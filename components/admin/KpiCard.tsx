import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  accent: "green" | "amber" | "red" | "blue"
}

const accentMap = {
  green: "border-[#2D7A5F] bg-[#2D7A5F]/5 text-[#2D7A5F]",
  amber: "border-amber-500 bg-amber-50 text-amber-600",
  red: "border-red-500 bg-red-50 text-red-600",
  blue: "border-blue-500 bg-blue-50 text-blue-600",
}

export function KpiCard({ label, value, sub, icon: Icon, accent }: KpiCardProps) {
  return (
    <div className={cn("rounded-xl border-l-4 bg-white p-5 shadow-sm", accentMap[accent].split(" ").slice(0, 2).join(" "))}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">{label}</p>
          <p className="mt-1 text-3xl font-bold text-[#2B3441]">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[#6B7280]">{sub}</p>}
        </div>
        <span className={cn("rounded-lg p-2.5", accentMap[accent].split(" ").slice(0, 3).join(" "))}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}
