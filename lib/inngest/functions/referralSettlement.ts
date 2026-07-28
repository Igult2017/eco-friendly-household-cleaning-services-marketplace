import { inngest } from "../client"
import { db } from "@/lib/db"
import { referralCommissions, referralCredits, referralPayouts, notifications, users, providers } from "@/lib/db/schema"
import { and, eq, lt, sql, inArray } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"

// Month-end referral settlement. Commissions accrue as `pending` when bookings complete
// (completion.ts) and are moved into the referrer's withdrawable credit balance in one batch on
// the 1st of each month — everything earned before the month began. Clawbacks in the interim
// cancel pending rows without a wallet ever having been touched.
export const settleReferralCommissions = inngest.createFunction(
  { id: "referral-monthly-settlement", retries: 3, triggers: [{ cron: "0 3 1 * *" }] },
  async ({ step }: { step: any }) => {
    // Atomic: flip + wallet credit commit together, so a retry re-runs on nothing (the pending
    // rows are already credited) instead of double-crediting wallets.
    const perUser: [string, number][] = await step.run("settle", async () => {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)
      return db.transaction(async (tx) => {
        const settled = await tx
          .update(referralCommissions)
          .set({ status: "credited", creditedAt: new Date() })
          .where(and(eq(referralCommissions.status, "pending"), lt(referralCommissions.createdAt, monthStart)))
          .returning({ referrerId: referralCommissions.referrerId, cents: referralCommissions.commissionCents })
        const byUser = new Map<string, number>()
        for (const s of settled) byUser.set(s.referrerId, (byUser.get(s.referrerId) ?? 0) + s.cents)
        for (const [userId, cents] of byUser) {
          await tx
            .insert(referralCredits)
            .values({ userId, balanceCents: cents, lifetimeEarnedCents: cents })
            .onConflictDoUpdate({
              target: referralCredits.userId,
              set: {
                balanceCents: sql`referral_credits.balance_cents + ${cents}`,
                lifetimeEarnedCents: sql`referral_credits.lifetime_earned_cents + ${cents}`,
                updatedAt: new Date(),
              },
            })
        }
        return Array.from(byUser.entries())
      })
    })

    if (!perUser.length) return { settled: 0 }

    // Cleaner cash commissions are auto-paid out here — fully automated, no admin action. Client
    // discount balances are NOT swept (they choose to spend at checkout or withdraw on demand —
    // see /api/referrals/withdraw). Sweeps each cleaner's FULL current wallet balance (not just this
    // month's delta) so a past failed payout gets retried automatically next month too.
    const payoutResults: { userId: string; paid: boolean; reason?: string }[] = await step.run("auto-payout-cleaners", async () => {
      const referrerIds = perUser.map(([userId]) => userId)
      const cleanerRows = await db
        .select({ userId: users.id, stripeAccountId: providers.stripeAccountId, stripeAccountStatus: providers.stripeAccountStatus })
        .from(users)
        .innerJoin(providers, eq(providers.userId, users.id))
        .where(and(inArray(users.id, referrerIds), eq(users.role, "provider")))

      const results: { userId: string; paid: boolean; reason?: string }[] = []
      for (const cleaner of cleanerRows) {
        if (!cleaner.stripeAccountId || cleaner.stripeAccountStatus !== "active") {
          results.push({ userId: cleaner.userId, paid: false, reason: "payout_account_not_ready" })
          continue
        }
        const [wallet] = await db.select({ balance: referralCredits.balanceCents }).from(referralCredits).where(eq(referralCredits.userId, cleaner.userId))
        const amountCents = wallet?.balance ?? 0
        if (amountCents <= 0) continue

        const [debited] = await db
          .update(referralCredits)
          .set({ balanceCents: sql`referral_credits.balance_cents - ${amountCents}`, updatedAt: new Date() })
          .where(and(eq(referralCredits.userId, cleaner.userId), sql`balance_cents >= ${amountCents}`))
          .returning({ id: referralCredits.id })
        if (!debited) { results.push({ userId: cleaner.userId, paid: false, reason: "balance_changed" }); continue }

        const [payoutRow] = await db.insert(referralPayouts).values({ userId: cleaner.userId, amountCents, status: "pending" }).returning({ id: referralPayouts.id })
        try {
          const transfer = await stripe.transfers.create(
            { amount: amountCents, currency: "eur", destination: cleaner.stripeAccountId },
            { idempotencyKey: `referral-settlement-payout-${payoutRow.id}` },
          )
          await db.update(referralPayouts).set({ status: "paid", stripeTransferId: transfer.id }).where(eq(referralPayouts.id, payoutRow.id))
          results.push({ userId: cleaner.userId, paid: true })
        } catch (transferErr) {
          await db.update(referralCredits).set({ balanceCents: sql`referral_credits.balance_cents + ${amountCents}`, updatedAt: new Date() }).where(eq(referralCredits.userId, cleaner.userId))
          const message = transferErr instanceof Error ? transferErr.message : "Transfer failed"
          await db.update(referralPayouts).set({ status: "failed", failureReason: message }).where(eq(referralPayouts.id, payoutRow.id))
          console.error(`[referral-settlement] payout transfer failed for ${cleaner.userId}:`, transferErr)
          results.push({ userId: cleaner.userId, paid: false, reason: "transfer_failed" })
        }
      }
      return results
    })

    await step.run("notify", async () => {
      for (const [userId] of perUser) {
        try {
          await db.insert(notifications).values({
            userId,
            type: "payment_received",
            title: "Referral earnings credited",
            body: "Your referral commissions from last month were credited to your balance.",
            link: "/dashboard",
            metadata: { variant: "referral_settled" },
          })
        } catch { /* notification is best-effort */ }
      }
    })

    return { settled: perUser.length, paidOut: payoutResults.filter((r) => r.paid).length }
  }
)
