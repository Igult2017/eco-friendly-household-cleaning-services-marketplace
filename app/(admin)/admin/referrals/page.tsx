export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { referrals, referralCommissions, referralCredits, users } from "@/lib/db/schema"
import { eq, desc, count, sum, sql } from "drizzle-orm"
import { Users, TrendingUp, Wallet, CheckCircle2, Clock, Gift } from "lucide-react"

function fmt(cents: number) {
  return `€${(cents / 100).toFixed(2)}`
}

export default async function AdminReferralsPage() {
  let allReferrals: {
    id: string
    referrerId: string
    referredId: string
    code: string
    status: "pending" | "active" | "invalid"
    activatedAt: Date | null
    totalEarned: number
    createdAt: Date
    referrerEmail: string | null
    referrerFirst: string | null
  }[] = []
  let totals: { total: number; active: number; pending: number; totalCommission: string | null } | null = null
  let totalCreditCents = 0
  let totalCommissionCents = 0
  let errorMsg: string | null = null

  try {
    const [rows, [totalsRow]] = await Promise.all([
      db
        .select({
          id: referrals.id,
          referrerId: referrals.referrerId,
          referredId: referrals.referredId,
          code: referrals.code,
          status: referrals.status,
          activatedAt: referrals.activatedAt,
          totalEarned: referrals.totalCommissionEarnedCents,
          createdAt: referrals.createdAt,
          referrerEmail: users.email,
          referrerFirst: users.firstName,
        })
        .from(referrals)
        .leftJoin(users, eq(referrals.referrerId, users.id))
        .orderBy(desc(referrals.createdAt))
        .limit(100),

      db
        .select({
          total: count(),
          active: sql<number>`SUM(CASE WHEN ${referrals.status} = 'active' THEN 1 ELSE 0 END)`.mapWith(Number),
          pending: sql<number>`SUM(CASE WHEN ${referrals.status} = 'pending' THEN 1 ELSE 0 END)`.mapWith(Number),
          totalCommission: sum(referrals.totalCommissionEarnedCents),
        })
        .from(referrals),
    ])

    allReferrals = rows
    totals = totalsRow ?? null

    const creditRows = await db
      .select({ total: sum(referralCredits.balanceCents) })
      .from(referralCredits)

    totalCreditCents = Number(creditRows[0]?.total ?? 0)
    totalCommissionCents = Number(totals?.totalCommission ?? 0)
  } catch (err) {
    console.error("[AdminReferralsPage]", err)
    errorMsg = "Failed to load referral data. The referral tables may still be migrating — try refreshing in a moment."
  }

  const STATUS_CFG: Record<string, { pill: string; icon: React.ReactNode }> = {
    active:  { pill: "bg-green-50 text-green-700",  icon: <CheckCircle2 size={11} /> },
    pending: { pill: "bg-amber-50 text-amber-700",  icon: <Clock size={11} /> },
    invalid: { pill: "bg-red-50 text-red-600",      icon: <Gift size={11} /> },
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D1F0E0] flex items-center justify-center">
          <Gift size={18} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441] leading-tight">Referral Programme</h1>
          <p className="text-sm text-[#6B7280]">Track referrals, commissions, and credit balances</p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { icon: Users,     label: "Total Referrals", value: String(totals?.total ?? 0),           sub: `${totals?.active ?? 0} active` },
          { icon: Clock,     label: "Pending",          value: String(totals?.pending ?? 0),         sub: "first booking not yet made" },
          { icon: TrendingUp,label: "Total Commission", value: fmt(totalCommissionCents),            sub: "5% of qualifying bookings" },
          { icon: Wallet,    label: "Credits Held",     value: fmt(totalCreditCents),               sub: "across all users" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="w-9 h-9 rounded-xl bg-[#D1F0E0] flex items-center justify-center mb-3">
              <Icon size={16} className="text-[#2D7A5F]" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">{label}</p>
            <p className="text-2xl font-bold text-[#2B3441] mt-1 tracking-tight">{value}</p>
            <p className="text-xs text-[#6B7280] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Referrals table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#2B3441]">All Referrals</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Most recent first — capped at 100</p>
          </div>
          <span className="text-xs font-semibold text-[#6B7280] bg-gray-100 rounded-full px-3 py-1">
            {allReferrals.length} shown
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="overflow-x-auto -mx-px"><table className="min-w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-gray-100">
                {["Referrer", "Code", "Status", "Commission Earned", "Activated", "Joined"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allReferrals.map((r) => {
                const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#D1F0E0] flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-[#2D7A5F]">
                            {(r.referrerFirst ?? r.referrerEmail ?? "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#2B3441]">
                            {r.referrerFirst ?? "—"}
                          </p>
                          <p className="text-xs text-[#6B7280]">{r.referrerEmail ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-[#2B3441]">{r.code}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${cfg.pill}`}>
                        {cfg.icon}
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#2B3441]">
                      {fmt(r.totalEarned ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#6B7280]">
                      {r.activatedAt ? new Date(r.activatedAt).toLocaleDateString("de-DE") : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#6B7280]">
                      {new Date(r.createdAt).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                )
              })}
              {allReferrals.length === 0 && !errorMsg && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-[#F4FAF6] flex items-center justify-center">
                        <Gift size={18} className="text-[#4CB87A]" />
                      </div>
                      <p className="text-sm font-semibold text-[#2B3441]">No referrals yet</p>
                      <p className="text-xs text-[#6B7280]">Referrals appear here once users share their link and someone signs up.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  )
}
