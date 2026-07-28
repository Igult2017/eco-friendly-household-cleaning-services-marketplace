import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, bookings } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { createConnectAccount, createAccountSession } from "@/lib/stripe/connect"
import { logError } from "@/lib/utils/logError"

// A lightweight Stripe Connect Express account any user can create on demand purely to withdraw a
// referral discount balance — separate from providers.stripeAccountId (job payouts). Reuses the
// same embedded-onboarding pattern as the cleaner payout flow (see StripeConnectEmbed.tsx).
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [user] = await db
      .select({ email: users.email, referralPayoutAccountId: users.referralPayoutAccountId })
      .from(users)
      .where(eq(users.id, userId))
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    let stripeAccountId = user.referralPayoutAccountId

    if (!stripeAccountId) {
      // No stored country for arbitrary users — best-effort from their most recent booking's
      // service address, else fall back to DE (same default used elsewhere in this codebase).
      const [recentBooking] = await db
        .select({ serviceAddress: bookings.serviceAddress })
        .from(bookings)
        .where(eq(bookings.customerId, userId))
        .orderBy(desc(bookings.createdAt))
        .limit(1)
      const country = (recentBooking?.serviceAddress as { country?: string } | undefined)?.country ?? "DE"

      const account = await createConnectAccount({
        email: user.email ?? undefined,
        country,
        idempotencyKey: `referral-connect-acct-${userId}`,
      })
      stripeAccountId = account.id

      try {
        await db.update(users).set({ referralPayoutAccountId: stripeAccountId, referralPayoutAccountStatus: "pending" }).where(eq(users.id, userId))
      } catch (dbErr) {
        console.error(`[referrals/connect-account] account ${account.id} created for user ${userId} but DB update failed:`, dbErr)
        throw dbErr
      }
    }

    const clientSecret = await createAccountSession(stripeAccountId)
    return NextResponse.json({ clientSecret })
  } catch (err) {
    console.error("[referrals/connect-account POST]", err)
    void logError({ message: "[referrals/connect-account POST]", error: err, route: "/api/referrals/connect-account", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
