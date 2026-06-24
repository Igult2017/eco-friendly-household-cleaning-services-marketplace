import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { ShieldCheck } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const role = user.publicMetadata?.role as string | undefined
  if (role !== "admin") redirect("/")

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.emailAddresses[0]?.emailAddress || "Admin"
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "A"

  return (
    <NextIntlClientProvider>
    <div className="min-h-screen bg-[#F4FAF6]">
      <AdminSidebar />
      <div className="pl-60">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur border-b border-gray-200 flex items-center px-8 gap-4">
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#2D7A5F]" />
            <span className="text-sm font-medium text-[#2B3441]">{displayName}</span>
            <div className="h-7 w-7 rounded-full bg-[#2D7A5F] flex items-center justify-center text-white text-[11px] font-bold">
              {initials}
            </div>
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
    <CookieBanner />
    </NextIntlClientProvider>
  )
}
