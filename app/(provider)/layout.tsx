import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { UserButton } from "@clerk/nextjs"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { RoleSwitcher } from "@/components/layout/RoleSwitcher"
import { LayoutDashboard } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { RoleSwitchToast } from "@/components/layout/RoleSwitchToast"

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("providerLayout")
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const { sessionClaims } = await auth()
  const jwtMeta  = sessionClaims?.metadata as { role?: string } | undefined
  const liveMeta = user.publicMetadata as { role?: string; dualRole?: boolean } | undefined
  // Use live publicMetadata for dualRole — JWT is stale for up to 60s after enablement
  const isDual      = liveMeta?.dualRole === true
  const primaryRole = jwtMeta?.role ?? liveMeta?.role ?? "customer"

  // Admin: allowed through (can view provider views, e.g. My Cleaner Account)
  if (primaryRole !== "admin") {
    const cookieStore = await cookies()
    const activeRole = isDual ? cookieStore.get("dorix_active_role")?.value : undefined
    const effectiveRole = activeRole ?? primaryRole
    if (effectiveRole === "customer") redirect("/dashboard")
    if (effectiveRole && effectiveRole !== "provider") redirect("/")
  }

  const showSwitcher = isDual && primaryRole !== "admin"

  return (
    <NextIntlClientProvider>
    <div className="min-h-screen bg-[#F4FAF6]">
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-4">
          <Link href="/"><Image src="/logo.png" alt="DORIXÉ" width={100} height={36} priority /></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B7280]">
            <Link href="/provider/dashboard" className="hover:text-[#2D7A5F] transition-colors">{t("dashboard")}</Link>
            <Link href="/provider/jobs" className="hover:text-[#2D7A5F] transition-colors">{t("findJobs")}</Link>
            <Link href="/provider/bookings" className="hover:text-[#2D7A5F] transition-colors">{t("bookings")}</Link>
            <Link href="/provider/earnings" className="hover:text-[#2D7A5F] transition-colors">{t("earnings")}</Link>
            <Link href="/provider/profile/services" className="hover:text-[#2D7A5F] transition-colors">{t("pricing")}</Link>
            <Link href="/provider/profile" className="hover:text-[#2D7A5F] transition-colors">{t("profile")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            {primaryRole === "admin" && (
              <Link
                href="/admin/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5EDE9] bg-white text-[#2B3441] hover:bg-[#F4FAF6] transition-colors"
              >
                <LayoutDashboard size={13} />
                {t("adminPanel")}
              </Link>
            )}
            {showSwitcher && <RoleSwitcher currentRole="provider" targetRole="customer" />}
            <NotificationBell />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
    <CookieBanner />
    <RoleSwitchToast />
    </NextIntlClientProvider>
  )
}
