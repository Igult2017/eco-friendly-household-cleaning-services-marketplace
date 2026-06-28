import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { AdminShell } from "@/components/admin/AdminShell"
import { CookieBanner } from "@/components/gdpr/CookieBanner"

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
      <AdminShell displayName={displayName} initials={initials}>
        {children}
      </AdminShell>
      <CookieBanner />
    </NextIntlClientProvider>
  )
}
