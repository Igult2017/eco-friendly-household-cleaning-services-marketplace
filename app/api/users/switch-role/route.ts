import { auth, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

const VALID_ROLES = ["customer", "provider"] as const
type SwitchableRole = typeof VALID_ROLES[number]

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const meta = sessionClaims?.metadata as { role?: string; dualRole?: boolean } | undefined

    // JWT can be stale (60s TTL) — fall back to live Clerk data for role check
    let primaryRole = meta?.role as string | undefined
    let isDual = meta?.dualRole === true
    if (!primaryRole || primaryRole === "customer") {
      const user = await currentUser()
      const liveMeta = user?.publicMetadata as { role?: string; dualRole?: boolean } | undefined
      primaryRole = liveMeta?.role ?? primaryRole ?? "customer"
      isDual = isDual || liveMeta?.dualRole === true
    }

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
