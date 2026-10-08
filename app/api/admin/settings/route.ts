import { auth, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { platformSettings } from "@/lib/db/schema"
import { z } from "zod"
import { logError } from "@/lib/utils/logError"

const updateSchema = z.object({
  commission_pct:        z.number().int().min(0).max(60).optional(),
  commission_regular_pct: z.number().int().min(0).max(60).optional(),
  commission_regular_after_jobs: z.number().int().min(0).max(50).optional(),
  payout_schedule:       z.enum(["weekly", "monthly"]).optional(),
  // max_service_radius_km is gone: cleaners set any radius they like, so nothing read it any more.
  min_booking_minutes:   z.number().int().min(15).max(480).optional(),
  // Cancellation & no-show policy — see lib/platform/settings.ts getCancellationConfig().
  cancel_tier1_hours:          z.number().int().min(1).max(168).optional(),
  cancel_tier2_hours:          z.number().int().min(1).max(168).optional(),
  cancel_tier3_hours:          z.number().int().min(0).max(168).optional(),
  cancel_fee_low_pct:          z.number().int().min(0).max(100).optional(),
  cancel_fee_medium_pct:       z.number().int().min(0).max(100).optional(),
  cancel_fee_late_pct:         z.number().int().min(0).max(100).optional(),
  cancel_travel_comp_cents:    z.number().int().min(0).max(50_000).optional(),
  cancel_noshow_grace_minutes: z.number().int().min(0).max(120).optional(),
  // Referral programme — ONE flat reward, paid once at a job threshold. See lib/referrals/rewards.ts.
  referral_reward_cents:          z.number().int().min(0).max(100_000).optional(),
  referral_cleaner_jobs_required: z.number().int().min(1).max(20).optional(),
  referral_client_jobs_required:  z.number().int().min(1).max(20).optional(),
  // The affiliate programme is separate and still percentage-based, per booking, ongoing.
  client_referral_discount_pct: z.number().int().min(0).max(20).optional(),
  recurring_discount_pct:       z.number().int().min(0).max(50).optional(),
  // Minimum hourly wage floor — see lib/platform/settings.ts getMinHourlyRateCents().
  min_hourly_rate_cents: z.number().int().min(0).max(100_000).optional(),
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
    void logError({ message: "[admin/settings GET]", error: err, route: "/api/admin/settings", severity: "error" })
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
    void logError({ message: "[admin/settings PATCH]", error: err, route: "/api/admin/settings", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
