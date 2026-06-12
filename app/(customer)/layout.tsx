import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { UserButton } from "@clerk/nextjs"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  // JWT claims are fresher than publicMetadata on the first render after onboarding.
  const { sessionClaims } = await auth()
  const jwtRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  const role = jwtRole ?? (user.publicMetadata?.role as string | undefined)

  // Non-customers: providers go to /provider/dashboard, admins to /admin/dashboard
  if (role === "provider") redirect("/provider/dashboard")
  if (role === "admin") redirect("/admin/dashboard")
  // No role yet → onboarding incomplete; middleware handles this, but be safe
  if (role && role !== "customer") redirect("/")

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-4">
          <Link href="/"><Image src="/logo.png" alt="DORIX" width={100} height={36} priority /></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B7280]">
            <Link href="/dashboard" className="hover:text-[#2D7A5F] transition-colors">Dashboard</Link>
            <Link href="/book" className="hover:text-[#2D7A5F] transition-colors">Book</Link>
            <Link href="/post-job" className="hover:text-[#2D7A5F] transition-colors">Post a job</Link>
            <Link href="/jobs" className="hover:text-[#2D7A5F] transition-colors">My jobs</Link>
            <Link href="/payments" className="hover:text-[#2D7A5F] transition-colors">Payments</Link>
            <Link href="/notifications" className="hover:text-[#2D7A5F] transition-colors">Notifications</Link>
            <Link href="/profile" className="hover:text-[#2D7A5F] transition-colors">Profile</Link>
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
