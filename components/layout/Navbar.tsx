"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { Menu, X, LayoutDashboard } from "lucide-react"

const NAV_LINKS = [
  { href: "/browse", label: "Find cleaners" },
  { href: "/browse-jobs", label: "Browse jobs" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/become-a-cleaner", label: "Become a cleaner" },
]

function dashboardHref(role: string | undefined) {
  if (role === "provider") return "/provider/dashboard"
  if (role === "admin") return "/admin/dashboard"
  return "/dashboard"
}

function dashboardLabel(role: string | undefined) {
  if (role === "provider") return "Cleaner dashboard"
  if (role === "admin") return "Admin panel"
  return "My dashboard"
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isSignedIn, user } = useUser()
  const role = user?.publicMetadata?.role as string | undefined
  const href = dashboardHref(role)
  const label = dashboardLabel(role)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E5EDE9]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex-shrink-0">
          <Image src="/logo.png" alt="DORIX" width={110} height={40} priority />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ href: navHref, label: navLabel }) => (
            <Link
              key={navHref}
              href={navHref}
              className="text-sm text-[#6B7280] hover:text-[#2B3441] transition-colors font-medium"
            >
              {navLabel}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <>
              <Link
                href={href}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[#EDF5F0] text-[#2D7A5F] hover:bg-[#D4EDE2] transition-colors"
              >
                <LayoutDashboard size={15} />
                {label}
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-[#2B3441] hover:text-[#2D7A5F] transition-colors hidden sm:block px-3 py-1.5">
                  Sign in
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-[#2D7A5F] text-white hover:bg-[#235f49] transition-colors hidden sm:block">
                  Start booking
                </button>
              </SignInButton>
            </>
          )}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-[#E5EDE9] px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ href: navHref, label: navLabel }) => (
            <Link
              key={navHref}
              href={navHref}
              className="text-sm text-[#6B7280] hover:text-[#2B3441] py-2 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {navLabel}
            </Link>
          ))}
          <div className="pt-2 border-t border-[#E5EDE9] mt-1">
            {isSignedIn ? (
              <Link
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-[#EDF5F0] text-[#2D7A5F]"
              >
                <LayoutDashboard size={15} /> {label}
              </Link>
            ) : (
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <button className="flex-1 text-sm font-medium py-2 rounded-lg border border-[#E5EBF0] text-[#2B3441]">
                    Sign in
                  </button>
                </SignInButton>
                <SignInButton mode="modal">
                  <button className="flex-1 text-sm font-semibold py-2 rounded-lg bg-[#2D7A5F] text-white">
                    Start booking
                  </button>
                </SignInButton>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
