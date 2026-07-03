import { inngest } from "../client"
import { db } from "@/lib/db"
import { referralCommissions, referralCredits, notifications } from "@/lib/db/schema"
import { and, eq, lt, sql } from "drizzle-orm"

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

    return { settled: perUser.length }
  }
)
