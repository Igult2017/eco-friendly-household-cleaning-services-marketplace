import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getConnectAccountStatus } from "@/lib/stripe/connect"
import { logError } from "@/lib/utils/logError"

// Live-refreshes the caller's referral-payout Connect status immediately after they exit the
// embedded onboarding component (see ReferralPayoutConnect.tsx), mirroring
// /api/stripe/connect/status for the cleaner job-payout flow — but against users.referralPayoutAccount*
// instead of providers.*, since there's no webhook wired for this separate account population.
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [user] = await db
      .select({ accountId: users.referralPayoutAccountId, status: users.referralPayoutAccountStatus })
      .from(users)
      .where(eq(users.id, userId))

    if (!user?.accountId) return NextResponse.json({ status: null })

    const status = await getConnectAccountStatus(user.accountId)
    if (status !== user.status) {
      await db.update(users).set({ referralPayoutAccountStatus: status }).where(eq(users.id, userId))
    }
    return NextResponse.json({ status })
  } catch (err) {
    console.error("[referrals/connect-status POST]", err)
    void logError({ message: "[referrals/connect-status POST]", error: err, route: "/api/referrals/connect-status", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
