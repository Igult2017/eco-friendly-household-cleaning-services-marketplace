"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Briefcase,
  CalendarCheck,
  MessageSquareWarning,
  LifeBuoy,
  Wallet,
  Star,
  Leaf,
  ChevronRight,
  Bug,
  BarChart3,
  Tag,
  Newspaper,
  Gift,
  ExternalLink,
  Banknote,
  Mail,
  ShoppingBag,
  Settings,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { label: "Dashboard",   href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users",       href: "/admin/users",      icon: ShieldCheck },
  { label: "Providers",   href: "/admin/providers",  icon: Briefcase },
  { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
  { label: "Disputes", href: "/admin/disputes", icon: MessageSquareWarning },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Payments", href: "/admin/payments", icon: Wallet },
  { label: "Payouts",  href: "/admin/payouts",  icon: Banknote },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Eco", href: "/admin/eco", icon: Leaf },
  { label: "Errors", href: "/admin/errors", icon: Bug },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Promo Codes", href: "/admin/promo-codes", icon: Tag },
  { label: "Referrals",   href: "/admin/referrals",   icon: Gift },
  { label: "Marketing", href: "/admin/marketing", icon: Mail },
  { label: "Blog",     href: "/admin/content/blog", icon: Newspaper },
  { label: "Eco-store", href: "/admin/content/store", icon: ShoppingBag },
  { label: "Settings", href: "/admin/settings",    icon: Settings },
]

// Responsive drawer: off-canvas on mobile (slides in when `open`), static on lg+. Tapping a link or the
// close button calls onNavigate so the drawer dismisses itself on mobile.
export function AdminSidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 w-60 bg-[#2B3441] flex flex-col z-50 transition-transform duration-200 ease-out lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="h-16 flex items-center px-5 border-b border-white/10 gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#2D7A5F] flex items-center justify-center flex-shrink-0">
          <Leaf className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-serif font-bold text-white text-[17px] tracking-tight leading-none">DORIXÉ</span>
        <span className="text-[9px] uppercase tracking-[0.15em] text-[#4CB87A] font-bold mt-0.5">Admin</span>
        <button
          onClick={onNavigate}
          aria-label="Close menu"
          className="lg:hidden ml-auto -mr-1 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
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
      <div className="p-3 border-t border-white/10 space-y-2">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          <span className="flex-1">View Marketplace</span>
        </Link>
        <p className="text-white/25 text-xs px-3">DORIXÉ Platform v1.0</p>
      </div>
    </aside>
  )
}
