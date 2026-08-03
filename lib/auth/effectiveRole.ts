import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"

// Best-effort "which view is this person currently browsing" resolution for read-only,
// display-only filtering — same trust level as app/api/jobs/public's canBid check (the cookie is
// trusted directly, not re-verified against live Clerk data), since this only affects which
// notifications are DISPLAYED, not any access control. Middleware is what actually enforces
// role-gated routes; getting this wrong for a moment just shows a stale list, not a security gap.
export async function getEffectiveRoleForDisplay(): Promise<string | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  const jwtRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  const cookieStore = await cookies()
  const activeRole = cookieStore.get("dorix_active_role")?.value
  if (activeRole === "customer" || activeRole === "provider") return activeRole
  return jwtRole ?? "customer"
}
