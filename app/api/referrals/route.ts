import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { redis } from "@/lib/redis/client"
import { Ratelimit } from "@upstash/ratelimit"
import { db } from "@/lib/db"

const referralRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "60 s"), prefix: "ratelimit:referral" })
import { referralCodes, referrals, referralCredits } from "@/lib/db/schema"
import { eq, count, sql } from "drizzle-orm"
import { customAlphabet } from "nanoid"

// Strict alphanumeric — no `-` or `_` from nanoid's default alphabet.
// The middleware regex [A-Z0-9]{6,20} must match every generated code.
const genCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8)

function generateCode(): string {
  return genCode()
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { success } = await referralRatelimit.limit(userId)
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    // Fetch or auto-create the user's referral code
    let [codeRow] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, userId))
      .limit(1)

    if (!codeRow) {
      const code = generateCode()
      ;[codeRow] = await db
        .insert(referralCodes)
        .values({ userId, code })
        .onConflictDoNothing()
        .returning()

      // onConflictDoNothing returns [] if there was a race — re-fetch
      if (!codeRow) {
        ;[codeRow] = await db
          .select()
          .from(referralCodes)
          .where(eq(referralCodes.userId, userId))
          .limit(1)
      }
    }

    // Referral stats
    const [stats] = await db
      .select({
        total: count(),
        active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`.mapWith(Number),
        pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`.mapWith(Number),
        totalEarned: sql<number>`COALESCE(SUM(total_commission_earned_cents), 0)`.mapWith(Number),
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId))

    // Credit balance
    const [credit] = await db
      .select({ balance: referralCredits.balanceCents, lifetime: referralCredits.lifetimeEarnedCents })
      .from(referralCredits)
      .where(eq(referralCredits.userId, userId))
      .limit(1)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

    return NextResponse.json({
      code: codeRow?.code ?? null,
      referralUrl: codeRow ? `${appUrl}/?ref=${codeRow.code}` : null,
      stats: {
        total: Number(stats?.total ?? 0),
        active: Number(stats?.active ?? 0),
        pending: Number(stats?.pending ?? 0),
        totalEarnedCents: Number(stats?.totalEarned ?? 0),
      },
      credit: {
        balanceCents: credit?.balance ?? 0,
        lifetimeEarnedCents: credit?.lifetime ?? 0,
      },
    })
  } catch (err) {
    console.error("[/api/referrals GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
