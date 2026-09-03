import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, referralCredits, referralPayouts } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { getConnectAccountStatus, getAccountPayoutCurrency } from "@/lib/stripe/connect"
import { safeLimit, createRateLimiter } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

const withdrawRatelimit = createRateLimiter({ tokens: 5, windowSeconds: 60, prefix: "ratelimit:referral-withdraw" })

// On-demand withdrawal of a referral discount balance (clients — cash commissions for cleaners are
// auto-paid monthly by referralSettlement.ts). Withdrawal itself is fully automated: no admin
// approval step, per the "sending money must be automated, not manual" requirement.
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success } = await safeLimit(withdrawRatelimit, userId)
    if (!success) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 })

    const [user] = await db.select({ accountId: users.referralPayoutAccountId }).from(users).where(eq(users.id, userId))
    if (!user?.accountId) {
      return NextResponse.json({ error: "Connect a payout account first.", code: "payout_account_not_ready" }, { status: 422 })
    }

    // Live check — never trust the last-known stored status for a money-moving action.
    const liveStatus = await getConnectAccountStatus(user.accountId)
    if (liveStatus !== "active") {
      await db.update(users).set({ referralPayoutAccountStatus: liveStatus }).where(eq(users.id, userId))
      return NextResponse.json({ error: "Your payout account isn't fully verified yet.", code: "payout_account_not_ready" }, { status: 422 })
    }

    const [wallet] = await db.select({ balance: referralCredits.balanceCents }).from(referralCredits).where(eq(referralCredits.userId, userId))
    const amountCents = wallet?.balance ?? 0
    if (amountCents <= 0) return NextResponse.json({ error: "Nothing to withdraw." }, { status: 422 })

    // Atomic conditional decrement FIRST — guards against a double-submit or concurrent checkout
    // spend racing this same balance. 0 rows back means the balance already moved; abort cleanly.
    const [debited] = await db
      .update(referralCredits)
      .set({ balanceCents: sql`referral_credits.balance_cents - ${amountCents}`, updatedAt: new Date() })
      .where(and(eq(referralCredits.userId, userId), sql`balance_cents >= ${amountCents}`))
      .returning({ id: referralCredits.id })
    if (!debited) return NextResponse.json({ error: "Your balance changed. Please try again." }, { status: 409 })

    const [payoutRow] = await db
      .insert(referralPayouts)
      .values({ userId, amountCents, status: "pending" })
      .returning({ id: referralPayouts.id })

    try {
      // The payee's own currency, not a hardcoded euro — a US withdrawal was being sent in EUR.
      const currency = await getAccountPayoutCurrency(user.accountId)
      const transfer = await stripe.transfers.create(
        { amount: amountCents, currency, destination: user.accountId },
        { idempotencyKey: `referral-withdraw-${payoutRow.id}` },
      )
      await db.update(referralPayouts).set({ status: "paid", stripeTransferId: transfer.id }).where(eq(referralPayouts.id, payoutRow.id))
      return NextResponse.json({ success: true, amountCents })
    } catch (transferErr) {
      // Stripe call failed after the debit — give the balance back and record the failure.
      await db
        .update(referralCredits)
        .set({ balanceCents: sql`referral_credits.balance_cents + ${amountCents}`, updatedAt: new Date() })
        .where(eq(referralCredits.userId, userId))
      const message = transferErr instanceof Error ? transferErr.message : "Transfer failed"
      await db.update(referralPayouts).set({ status: "failed", failureReason: message }).where(eq(referralPayouts.id, payoutRow.id))
      console.error("[referrals/withdraw] Stripe transfer failed:", transferErr)
      return NextResponse.json({ error: "Withdrawal failed. Your balance has not been deducted — please try again." }, { status: 502 })
    }
  } catch (err) {
    console.error("[referrals/withdraw POST]", err)
    void logError({ message: "[referrals/withdraw POST]", error: err, route: "/api/referrals/withdraw", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
