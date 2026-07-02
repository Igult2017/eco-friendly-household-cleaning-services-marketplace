"use client"

import { Link } from "@/i18n/navigation"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { LogoImage } from "@/components/layout/LogoImage"
import { useState } from "react"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { Menu, X, Leaf } from "lucide-react"
import { useTranslations } from "next-intl"
import { AdminCleanerSwitch } from "@/components/layout/AdminCleanerSwitch"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { DashboardLinkIcon } from "@/components/layout/DashboardLinkIcon"

const NAV_LINKS = [
  { href: "/browse", key: "findCleaners" },
  { href: "/browse-jobs", key: "browseJobs" },
  { href: "/#how-it-works", key: "howItWorks" },
  { href: "/become-a-cleaner", key: "becomeACleaner" },
  { href: "/blog", key: "blog" },
  { href: "/eco-store", key: "ecoStore" },
] as const

function dashboardHref(role: string | undefined) {
  if (role === "provider") return "/provider/dashboard"
  if (role === "admin") return "/admin/dashboard"
  if (role === "affiliate") return "/partner/dashboard"
  return "/dashboard"
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const t = useTranslations("nav")
  const role = (isLoaded ? user?.publicMetadata?.role : undefined) as string | undefined
  const href = dashboardHref(role)
  const label = role === "provider" ? t("cleanerDashboard") : role === "admin" ? t("adminPanel") : role === "affiliate" ? t("affiliateDashboard") : t("myDashboard")

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E5EDE9]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" prefetch={true} className="flex-shrink-0">
          <LogoImage />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ href: navHref, key }) => {
            // Eco-store gets a distinct eco-green pill + leaf so it stands out from the plain nav links.
            const isEco = key === "ecoStore"
            return (
              <Link
                key={navHref}
                href={navHref}
                prefetch={false}
                className={
                  isEco
                    ? "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-[#D1F0E0] text-[#2D7A5F] hover:bg-[#bfe9d3] transition-colors"
                    : "text-sm text-[#6B7280] hover:text-[#2B3441] transition-colors font-medium"
                }
              >
                {isEco && <Leaf className="w-3.5 h-3.5" />}
                {t(key)}
              </Link>
            )
          })}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isSignedIn ? (
            <>
              {role === "admin" && <AdminCleanerSwitch />}
              <NextLink
                href={isLoaded ? href : "#"}
                prefetch={false}
                onMouseEnter={() => { if (isLoaded) router.prefetch(href) }}
                onClick={!isLoaded ? (e) => e.preventDefault() : undefined}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[#EDF5F0] text-[#2D7A5F] hover:bg-[#D4EDE2] transition-colors"
              >
                <DashboardLinkIcon />
                {label}
              </NextLink>
              {/* Bell on the PUBLIC navbar too — see messages/notifications right at login, before
                  ever entering the dashboard. */}
              <NotificationBell />
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-[#2B3441] hover:text-[#2D7A5F] transition-colors hidden sm:block px-3 py-1.5">
                  {t("signIn")}
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-[#2D7A5F] text-white hover:bg-[#235f49] transition-colors hidden sm:block">
                  {t("startBooking")}
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
          {NAV_LINKS.map(({ href: navHref, key }) => {
            const isEco = key === "ecoStore"
            return (
              <Link
                key={navHref}
                href={navHref}
                prefetch={false}
                className={
                  isEco
                    ? "flex items-center gap-2 text-sm font-semibold text-[#2D7A5F] bg-[#D1F0E0] rounded-lg px-3 py-2 transition-colors"
                    : "text-sm text-[#6B7280] hover:text-[#2B3441] py-2 transition-colors"
                }
                onClick={() => setMobileOpen(false)}
              >
                {isEco && <Leaf className="w-4 h-4" />}
                {t(key)}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-[#E5EDE9] mt-1">
            {isSignedIn ? (
              <NextLink
                href={isLoaded ? href : "#"}
                prefetch={false}
                onClick={!isLoaded ? (e) => e.preventDefault() : () => setMobileOpen(false)}
                className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-[#EDF5F0] text-[#2D7A5F]"
              >
                <DashboardLinkIcon /> {label}
              </NextLink>
            ) : (
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <button className="flex-1 text-sm font-medium py-2 rounded-lg border border-[#E5EBF0] text-[#2B3441]">
                    {t("signIn")}
                  </button>
                </SignInButton>
                <SignInButton mode="modal">
                  <button className="flex-1 text-sm font-semibold py-2 rounded-lg bg-[#2D7A5F] text-white">
                    {t("startBooking")}
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
