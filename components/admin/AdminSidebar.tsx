"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarCheck,
  MessageSquareWarning,
  Wallet,
  Star,
  Leaf,
  ChevronRight,
  Bug,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Providers", href: "/admin/providers", icon: Briefcase },
  { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
  { label: "Disputes", href: "/admin/disputes", icon: MessageSquareWarning },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Payments", href: "/admin/payments", icon: Wallet },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Eco", href: "/admin/eco", icon: Leaf },
  { label: "Errors", href: "/admin/errors", icon: Bug },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-[#2B3441] flex flex-col z-40">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <Image src="/logo.png" alt="DORIX" width={90} height={32} className="brightness-0 invert" />
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[#4CB87A] font-semibold">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-[#2D7A5F] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3 w-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <p className="text-white/30 text-xs">DORIX Platform v1.0</p>
      </div>
    </aside>
  )
}
