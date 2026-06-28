"use client"

import { useState } from "react"
import { SignOutButton } from "@clerk/nextjs"
import { Menu, ShieldCheck, LogOut } from "lucide-react"
import { AdminSidebar } from "./AdminSidebar"

// Client shell for the admin area: holds the mobile drawer state, renders the responsive sidebar +
// backdrop, the top bar (with a hamburger on mobile), and the main content. The server layout stays
// thin (auth + identity) and just passes the display name/initials in.
export function AdminShell({
  displayName,
  initials,
  children,
}: {
  displayName: string
  initials: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <AdminSidebar open={open} onNavigate={() => setOpen(false)} />

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur border-b border-gray-200 flex items-center px-4 sm:px-6 lg:px-8 gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="lg:hidden -ml-1 p-2 rounded-lg text-[#2B3441] hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#2D7A5F]" />
            <span className="hidden sm:inline text-sm font-medium text-[#2B3441] truncate max-w-[40vw]">{displayName}</span>
            <div className="h-7 w-7 rounded-full bg-[#2D7A5F] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              {initials}
            </div>
            <SignOutButton redirectUrl="/">
              <button
                aria-label="Sign out"
                className="ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#6B7280] hover:bg-gray-100 hover:text-[#2B3441] transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </SignOutButton>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
