import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { OnboardingForm } from "./OnboardingForm"

const VALID_ROLES = ["customer", "provider", "admin", "affiliate"]

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const [{ intent }, user, { userId, sessionClaims }] = await Promise.all([searchParams, currentUser(), auth()])

  // Resolve the role from EVERY available source before deciding to show the chooser. The prod
  // session token doesn't carry the role claim, so a momentary publicMetadata read miss (Clerk API
  // slow/erroring on the single VPS) must not wrongly show onboarding to a user who already has a
  // role. Order: live publicMetadata → JWT claim → dorix_role cookie.
  let role =
    (user?.publicMetadata?.role as string | undefined) ??
    (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (!role && userId) {
    const ck = (await cookies()).get("dorix_role")?.value
    if (ck) {
      const [cookieUserId, cookieRole] = ck.split(":")
      if (cookieUserId === userId && VALID_ROLES.includes(cookieRole)) role = cookieRole
    }
  }

  // OUR OWN DATABASE, last and decisive. Every source above is either a network call to Clerk or a
  // browser cookie: on a loaded single VPS a slow Clerk read, or a cookie lost to a new browser, an
  // incognito window or a 7-day expiry, left an existing user staring at the sign-up form being
  // asked their name again — which is exactly what was reported. The users table holds the role
  // locally and authoritatively (every live account has the right one), so consulting it removes the
  // dependency on anything remote staying up.
  if (!role && userId) {
    try {
      const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
      if (row?.role && VALID_ROLES.includes(row.role)) role = row.role
    } catch {
      // Database unreachable too — fall through and show the form rather than a crash.
    }
  }

  if (role === "provider") redirect("/provider/dashboard")
  if (role === "customer") redirect("/dashboard")
  if (role === "admin") redirect("/admin/dashboard")
  if (role === "affiliate") redirect("/partner/dashboard")

  return (
    <OnboardingForm
      defaultFirstName={user?.firstName ?? ""}
      defaultLastName={user?.lastName ?? ""}
      defaultRole={intent === "affiliate" ? "affiliate" : undefined}
    />
  )
}
