import { auth, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { platformSettings } from "@/lib/db/schema"
import { z } from "zod"

const updateSchema = z.object({
  commission_pct:        z.number().int().min(1).max(50).optional(),
  referral_pct:          z.number().int().min(1).max(20).optional(),
  payout_schedule:       z.enum(["weekly", "biweekly", "monthly"]).optional(),
  max_service_radius_km: z.number().int().min(10).max(500).optional(),
  platform_name:         z.string().min(1).max(50).optional(),
})

type AdminCheckResult = "ok" | "unauthorized" | "forbidden"

async function assertAdmin(): Promise<AdminCheckResult> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return "unauthorized"
  const meta = sessionClaims?.metadata as { role?: string } | undefined
  let role = meta?.role
  if (!role) {
    const user = await currentUser()
    role = user?.publicMetadata?.role as string | undefined
  }
  return role === "admin" ? "ok" : "forbidden"
}

function authError(result: AdminCheckResult) {
  if (result === "unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function GET() {
  const check = await assertAdmin()
  if (check !== "ok") return authError(check)
  try {
    const rows = await db.select().from(platformSettings)
    const config = Object.fromEntries(rows.map(r => [r.key, r.value]))
    return NextResponse.json(config)
  } catch (err) {
    console.error("[admin/settings GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const check = await assertAdmin()
  if (check !== "ok") return authError(check)
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

    const updates = parsed.data
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        db
          .insert(platformSettings)
          .values({ key, value: String(value), updatedAt: new Date() })
          .onConflictDoUpdate({ target: platformSettings.key, set: { value: String(value), updatedAt: new Date() } })
      )
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/settings PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
