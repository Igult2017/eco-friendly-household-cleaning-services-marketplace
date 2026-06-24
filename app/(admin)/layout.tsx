import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { ShieldCheck } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect("/sign-in")

  // Resolve the admin role WITHOUT a per-request Clerk API call in the common case: prefer the JWT
  // metadata claim (present once the session token carries it), else the dorix_role cookie the
  // middleware sets. Only fall back to a Clerk fetch if neither has it (rare) — the /admin
  // middleware already gates this route, so this is defense-in-depth.
  let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (!role) {
    const ck = (await cookies()).get("dorix_role")?.value
    if (ck) {
      const [cid, cr] = ck.split(":")
      if (cid === userId) role = cr
    }
  }
  if (role !== "admin") {
    const clerkUser = await currentUser()
    if ((clerkUser?.publicMetadata as { role?: string })?.role !== "admin") redirect("/")
  }

  // Display identity from the local DB (fast) rather than a per-request Clerk fetch.
  const [u] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
  const displayName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Admin"
  const initials = [u?.firstName?.[0], u?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "A"

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
