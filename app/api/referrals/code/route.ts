import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { referralCodes } from "@/lib/db/schema"
import { sql, and, ne } from "drizzle-orm"
import { safeLimit, createRateLimiter } from "@/lib/redis/client"
import { validateRefCode } from "@/lib/referrals/code"
import { SITE_URL } from "@/lib/seo/site"
import { logError } from "@/lib/utils/logError"

const limiter = createRateLimiter({ tokens: 20, windowSeconds: 60, prefix: "ratelimit:refcode" })

// Is `code` free for this user to claim? Case-insensitive; the user's own current code counts as free.
async function isAvailable(code: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: referralCodes.userId })
    .from(referralCodes)
    .where(and(sql`lower(${referralCodes.code}) = ${code}`, ne(referralCodes.userId, userId)))
    .limit(1)
  return rows.length === 0
}

// GET /api/referrals/code?code=xxx — live availability check for the dashboard editor.
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { success } = await safeLimit(limiter, userId)
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    const raw = new URL(req.url).searchParams.get("code") ?? ""
    const v = validateRefCode(raw)
    if (!v.ok) return NextResponse.json({ available: false, code: v.code, error: v.error })
    const available = await isAvailable(v.code, userId)
    return NextResponse.json({ available, code: v.code, error: available ? undefined : "That handle is already taken." })
  } catch (err) {
    console.error("[referrals/code GET]", err)
    void logError({ message: "[referrals/code GET]", error: err, route: "/api/referrals/code", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/referrals/code { code } — set a custom (vanity) referral code.
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { success } = await safeLimit(limiter, userId)
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const v = validateRefCode(typeof body.code === "string" ? body.code : "")
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    if (!(await isAvailable(v.code, userId))) return NextResponse.json({ error: "That handle is already taken." }, { status: 409 })

    await db
      .insert(referralCodes)
      .values({ userId, code: v.code })
      .onConflictDoUpdate({ target: referralCodes.userId, set: { code: v.code } })

    return NextResponse.json({
      code: v.code,
      referralUrl: `${process.env.NEXT_PUBLIC_APP_URL || SITE_URL}/?ref=${v.code}`,
    })
  } catch (err) {
    // Lost a race for the code → the case-insensitive unique index rejects it.
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That handle was just taken — try another." }, { status: 409 })
    }
    console.error("[referrals/code PATCH]", err)
    void logError({ message: "[referrals/code PATCH]", error: err, route: "/api/referrals/code", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
