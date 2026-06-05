import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const role = user.publicMetadata?.role as string | undefined
  if (role !== "admin") redirect("/")

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <AdminSidebar />
      <div className="pl-60">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur border-b border-gray-200 flex items-center px-8 gap-4">
          <div className="flex-1" />
          <span className="text-sm text-[#6B7280]">Admin Portal</span>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
