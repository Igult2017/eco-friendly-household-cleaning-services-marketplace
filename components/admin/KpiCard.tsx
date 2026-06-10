import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  accent: "green" | "amber" | "red" | "blue" | "purple"
}

const cfg = {
  green:  { icon: "text-[#2D7A5F]", iconBg: "bg-[#2D7A5F]/10", pulse: "bg-[#2D7A5F]", hover: "hover:shadow-[#2D7A5F]/10" },
  amber:  { icon: "text-amber-500",  iconBg: "bg-amber-50",      pulse: "bg-amber-400",  hover: "hover:shadow-amber-100"    },
  red:    { icon: "text-red-500",    iconBg: "bg-red-50",        pulse: "bg-red-400",    hover: "hover:shadow-red-100"      },
  blue:   { icon: "text-blue-500",   iconBg: "bg-blue-50",       pulse: "bg-blue-400",   hover: "hover:shadow-blue-100"     },
  purple: { icon: "text-purple-500", iconBg: "bg-purple-50",     pulse: "bg-purple-400", hover: "hover:shadow-purple-100"   },
}

export function KpiCard({ label, value, sub, icon: Icon, accent }: KpiCardProps) {
  const c = cfg[accent]
  return (
    <div className={cn(
      "group relative flex flex-col gap-5 rounded-2xl bg-white px-6 py-5",
      "border border-gray-100 shadow-sm transition-all duration-200",
      "hover:-translate-y-0.5 hover:shadow-lg", c.hover
    )}>
      <div className="flex items-center justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", c.iconBg)}>
          <Icon className={cn("h-4 w-4", c.icon)} />
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full opacity-70", c.pulse)} />
          <span className={cn("h-1.5 w-1.5 rounded-full opacity-40", c.pulse)} />
        </span>
      </div>
      <div>
        <p className="text-[2rem] font-bold leading-none tracking-tight text-[#2B3441]">{value}</p>
        <p className="mt-2 text-sm font-medium text-[#4B5563]">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-[#9CA3AF]">{sub}</p>}
      </div>
    </div>
  )
}
