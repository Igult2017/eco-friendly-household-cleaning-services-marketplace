import { db } from "@/lib/db"
import { users, referrals, referralCodes, referralCommissions, referralCredits, referralPayouts } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export type ProgrammeKey = "affiliate" | "provider" | "customer"

export type ReferrerRow = {
  userId: string
  name: string
  email: string | null
  role: string
  code: string | null
  brought: number        // people who signed up with their code
  converted: number      // of those, how many actually earned (status went 'active')
  earnedCents: number    // lifetime, after any clawbacks
  pendingCents: number   // earned but not yet settled — settlement runs on the 1st
  balanceCents: number   // settled and sitting in their wallet
  paidOutCents: number   // actually transferred to them
  payoutReady: boolean   // is there a verified account to pay them into
}

// One row per person who has a referral code or has referred somebody. Every money figure comes
// from its own scalar subquery rather than a join, because joining referrals + commissions +
// payouts multiplies rows against each other and silently inflates every total.
export async function getReferrerPerformance(): Promise<ReferrerRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: users.role,
      code: referralCodes.code,
      payoutAccount: users.referralPayoutAccountId,
      payoutStatus: users.referralPayoutAccountStatus,
      brought: sql<number>`cast((select count(*) from referrals r where r.referrer_id = ${users.id}) as int)`,
      converted: sql<number>`cast((select count(*) from referrals r where r.referrer_id = ${users.id} and r.status = 'active') as int)`,
      earnedCents: sql<number>`cast((select coalesce(sum(r.total_commission_earned_cents), 0) from referrals r where r.referrer_id = ${users.id}) as int)`,
      // Not yet settled. Cancelled rows (clawed back after a refund) are excluded deliberately —
      // they are not owed to anybody.
      pendingCents: sql<number>`cast((select coalesce(sum(c.commission_cents), 0) from referral_commissions c where c.referrer_id = ${users.id} and c.status = 'pending') as int)`,
      // coalesce OUTSIDE the subquery: a user with no wallet row yet returns NO ROWS, and a
      // coalesce inside only rescues a null column, not a missing row. It came back null in testing
      // and only looked fine because JavaScript turns null into 0 — not something to rely on.
      balanceCents: sql<number>`cast(coalesce((select bal.balance_cents from referral_credits bal where bal.user_id = ${users.id}), 0) as int)`,
      paidOutCents: sql<number>`cast((select coalesce(sum(p.amount_cents), 0) from referral_payouts p where p.user_id = ${users.id} and p.status = 'paid') as int)`,
    })
    .from(users)
    .leftJoin(referralCodes, sql`${referralCodes.userId} = ${users.id}`)
    .where(
      sql`${referralCodes.code} is not null or exists (select 1 from referrals r where r.referrer_id = ${users.id})`,
    )

  return rows
    .map((r) => ({
      userId: r.userId,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "—",
      email: r.email,
      role: r.role,
      code: r.code,
      brought: Number(r.brought),
      converted: Number(r.converted),
      earnedCents: Number(r.earnedCents),
      pendingCents: Number(r.pendingCents),
      balanceCents: Number(r.balanceCents),
      paidOutCents: Number(r.paidOutCents),
      // Cleaners are paid through their cleaner Stripe account; everyone else through the separate
      // referral payout account. This column only reflects the latter, so it is reported as unknown
      // rather than false for cleaners — see the note rendered above the cleaner table.
      payoutReady: r.payoutStatus === "active" && !!r.payoutAccount,
    }))
    // Most owed first — that is the column an admin is actually scanning for.
    .sort((a, b) => (b.pendingCents + b.balanceCents) - (a.pendingCents + a.balanceCents) || b.brought - a.brought)
}

// Which table a person belongs in. Reward TYPE is decided by the referrer's role at
// lib/referrals/rewards.ts:46 — only "provider" earns cash commission; everyone else earns discount
// credit. So grouping by role is grouping by how someone actually gets paid, not a cosmetic split.
//
// Admin accounts hold referral codes too (2 of them in production), and they earn on the same terms
// as a client, so they belong in that bucket rather than being hidden — the table is titled to
// cover them honestly instead of claiming they are clients.
export function programmeOf(role: string): ProgrammeKey {
  if (role === "affiliate") return "affiliate"
  if (role === "provider") return "provider"
  return "customer"
}

export function owedCents(r: ReferrerRow): number {
  return r.pendingCents + r.balanceCents
}
