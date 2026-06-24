import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { UserButton } from "@clerk/nextjs"
import { getTranslations } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { RoleSwitcher } from "@/components/layout/RoleSwitcher"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { RoleSwitchToast } from "@/components/layout/RoleSwitchToast"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("customerLayout")
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const { sessionClaims } = await auth()
  const jwtMeta  = sessionClaims?.metadata as { role?: string } | undefined
  const liveMeta = user.publicMetadata as { role?: string; dualRole?: boolean } | undefined
  // Use live publicMetadata for dualRole — JWT is stale for up to 60s after enablement
  const isDual      = liveMeta?.dualRole === true
  const primaryRole = jwtMeta?.role ?? liveMeta?.role ?? "customer"

  // Admin: allowed through without redirect (they can browse customer views)
  if (primaryRole !== "admin") {
    const cookieStore = await cookies()
    const activeRole = isDual ? cookieStore.get("dorix_active_role")?.value : undefined
    const effectiveRole = activeRole ?? primaryRole
    if (effectiveRole === "provider") redirect("/provider/dashboard")
    if (effectiveRole && effectiveRole !== "customer") redirect("/")
  }

  const showSwitcher = isDual || primaryRole === "admin"

  return (
    <NextIntlClientProvider>
    <div className="min-h-screen bg-[#F4FAF6]">
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-4">
          <Link href="/"><Image src="/logo.png" alt="DORIXÉ" width={100} height={36} priority /></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B7280]">
            <Link href="/dashboard" className="hover:text-[#2D7A5F] transition-colors">{t("navDashboard")}</Link>
            <Link href="/book" className="hover:text-[#2D7A5F] transition-colors">{t("navBook")}</Link>
            <Link href="/post-job" className="hover:text-[#2D7A5F] transition-colors">{t("navPostJob")}</Link>
            <Link href="/jobs" className="hover:text-[#2D7A5F] transition-colors">{t("navMyJobs")}</Link>
            <Link href="/payments" className="hover:text-[#2D7A5F] transition-colors">{t("navPayments")}</Link>
            <Link href="/notifications" className="hover:text-[#2D7A5F] transition-colors">{t("navNotifications")}</Link>
            <Link href="/profile" className="hover:text-[#2D7A5F] transition-colors">{t("navProfile")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            {showSwitcher && <RoleSwitcher currentRole="customer" targetRole="provider" />}
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
