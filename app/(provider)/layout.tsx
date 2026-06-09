import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { UserButton } from "@clerk/nextjs"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const role = user.publicMetadata?.role as string | undefined
  if (!role || role !== "provider") redirect("/")

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-4">
          <Link href="/"><Image src="/logo.png" alt="DORIX" width={100} height={36} priority /></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B7280]">
            <Link href="/provider/dashboard" className="hover:text-[#2D7A5F] transition-colors">Dashboard</Link>
            <Link href="/provider/jobs" className="hover:text-[#2D7A5F] transition-colors">Find jobs</Link>
            <Link href="/provider/bookings" className="hover:text-[#2D7A5F] transition-colors">Bookings</Link>
            <Link href="/provider/earnings" className="hover:text-[#2D7A5F] transition-colors">Earnings</Link>
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
