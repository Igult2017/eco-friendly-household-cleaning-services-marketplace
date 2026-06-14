import { auth, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { safeLimit, createRateLimiter } from "@/lib/redis/client"

const switchRatelimit = createRateLimiter({ tokens: 10, windowSeconds: 60, prefix: "ratelimit:switch-role" })

const VALID_ROLES = ["customer", "provider"] as const
type SwitchableRole = typeof VALID_ROLES[number]

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(switchRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    // Always fetch live Clerk data — JWT dualRole may be stale if an admin revoked it
    // within the 60s JWT TTL window, which would create a false-positive bypass.
    const liveUser = await currentUser()
    const liveMeta = liveUser?.publicMetadata as { role?: string; dualRole?: boolean } | undefined
    const primaryRole = liveMeta?.role ?? "customer"
    const isDual      = liveMeta?.dualRole === true

    // Admin can always switch; others need dual role enabled
    if (primaryRole !== "admin" && !isDual) {
      return NextResponse.json({ error: "Dual role not enabled" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { targetRole } = body as { targetRole?: string }

    if (!targetRole || !VALID_ROLES.includes(targetRole as SwitchableRole)) {
      return NextResponse.json({ error: "targetRole must be 'customer' or 'provider'" }, { status: 400 })
    }

    const redirectTo = targetRole === "provider" ? "/provider/dashboard" : "/dashboard"

    const res = NextResponse.json({ success: true, redirectTo })
    res.cookies.set("dorix_active_role", targetRole, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return res
  } catch (err) {
    console.error("[switch-role POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
