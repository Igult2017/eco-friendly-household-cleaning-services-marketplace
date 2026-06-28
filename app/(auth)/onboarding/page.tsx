import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
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
