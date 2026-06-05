"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { SignInButton, UserButton } from "@clerk/nextjs"
import { Show } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

const NAV_LINKS = [
  { href: "/browse", label: "Find cleaners" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/become-a-cleaner", label: "Become a cleaner" },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E5EDE9]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image src="/logo.png" alt="DORIX" width={110} height={40} priority />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-[#6B7280] hover:text-[#2B3441] transition-colors font-medium"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="text-[#2B3441] hidden sm:flex">
                Sign in
              </Button>
            </SignInButton>
            <SignInButton mode="modal">
              <Button size="sm" className="bg-[#2D7A5F] hover:bg-[#235f49] text-white hidden sm:flex">
                Start booking
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-[#E5EDE9] px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-[#6B7280] hover:text-[#2B3441] py-2 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2 border-t border-[#E5EDE9] mt-1">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="flex-1">Sign in</Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button size="sm" className="flex-1 bg-[#2D7A5F] hover:bg-[#235f49] text-white">
                  Start booking
                </Button>
              </SignInButton>
            </Show>
          </div>
        </div>
      )}
    </header>
  )
}
