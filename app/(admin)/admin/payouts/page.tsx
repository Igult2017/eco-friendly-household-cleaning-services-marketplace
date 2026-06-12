export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { payouts, providers } from "@/lib/db/schema"
import { eq, desc, sum, count, sql } from "drizzle-orm"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { Wallet, TrendingUp, Clock, AlertCircle, CheckCircle2 } from "lucide-react"

function fmt(cents: number) {
  return `€${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`
}

export default async function AdminPayoutsPage() {
  let rows: {
    id: string
    amount: number
    status: string
    periodStart: string
    periodEnd: string
    processedAt: Date | null
    createdAt: Date
    stripeTransferId: string | null
    businessName: string | null
  }[] = []
  let kpi = { total: 0, pending: 0, failed: 0, paid: 0, count: 0 }
  let byProvider: { businessName: string | null; total: number; count: number }[] = []
  let errorMsg: string | null = null

  try {
    const [allPayouts, kpiRow, providerTotals] = await Promise.all([
      db
        .select({
          id:               payouts.id,
          amount:           payouts.amount,
          status:           payouts.status,
          periodStart:      payouts.periodStart,
          periodEnd:        payouts.periodEnd,
          processedAt:      payouts.processedAt,
          createdAt:        payouts.createdAt,
          stripeTransferId: payouts.stripeTransferId,
          businessName:     providers.businessName,
        })
        .from(payouts)
        .leftJoin(providers, eq(payouts.providerId, providers.id))
        .orderBy(desc(payouts.createdAt))
        .limit(100),

      db
        .select({
          total:   sum(payouts.amount),
          paid:    sql<number>`SUM(CASE WHEN ${payouts.status} = 'paid'    THEN ${payouts.amount} ELSE 0 END)`.mapWith(Number),
          pending: sql<number>`SUM(CASE WHEN ${payouts.status} = 'pending' THEN ${payouts.amount} ELSE 0 END)`.mapWith(Number),
          failed:  sql<number>`SUM(CASE WHEN ${payouts.status} = 'failed'  THEN ${payouts.amount} ELSE 0 END)`.mapWith(Number),
          count:   count(),
        })
        .from(payouts),

      db
        .select({
          businessName: providers.businessName,
          total:        sum(payouts.amount),
          count:        count(),
        })
        .from(payouts)
        .leftJoin(providers, eq(payouts.providerId, providers.id))
        .groupBy(providers.id, providers.businessName)
        .orderBy(desc(sum(payouts.amount)))
        .limit(10),
    ])

    rows = allPayouts
    const k = kpiRow[0]
    kpi = {
      total:   Number(k?.total   ?? 0),
      paid:    Number(k?.paid    ?? 0),
      pending: Number(k?.pending ?? 0),
      failed:  Number(k?.failed  ?? 0),
      count:   Number(k?.count   ?? 0),
    }
    byProvider = providerTotals.map(p => ({
      businessName: p.businessName,
      total:        Number(p.total ?? 0),
      count:        Number(p.count ?? 0),
    }))
  } catch (err) {
    console.error("[AdminPayoutsPage]", err)
    errorMsg = "Failed to load payout data. Check server logs."
  }

  const KPIS = [
    { label: "Total Paid Out",  value: fmt(kpi.paid),    icon: CheckCircle2, color: "text-[#2D7A5F]" },
    { label: "Pending",         value: fmt(kpi.pending),  icon: Clock,        color: "text-amber-500" },
    { label: "Failed",          value: fmt(kpi.failed),   icon: AlertCircle,  color: "text-red-500"   },
    { label: "Total Payout Runs", value: String(kpi.count), icon: TrendingUp, color: "text-[#2B3441]" },
  ]

  return (
    <div className="space-y-8">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
          <Wallet size={18} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Payouts</h1>
          <p className="text-sm text-[#6B7280]">Provider payout runs — triggered weekly by Inngest on Mondays 02:00 UTC</p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{errorMsg}</div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <Icon size={16} className={`${color} mb-3`} />
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">{label}</p>
            <p className="text-2xl font-bold text-[#2B3441] mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Payout run table */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#2B3441]">All Payout Runs</h2>
            <span className="text-xs text-[#6B7280] bg-gray-100 rounded-full px-3 py-1">{rows.length} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-gray-100">
                  {["Provider", "Period", "Amount", "Status", "Stripe Transfer", "Processed"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-[#2B3441]">{r.businessName ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-[#6B7280] whitespace-nowrap">
                      {r.periodStart} → {r.periodEnd}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-[#2B3441]">{fmt(r.amount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 font-mono text-xs text-[#6B7280]">
                      {r.stripeTransferId ? r.stripeTransferId.slice(-14) : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#6B7280]">
                      {r.processedAt ? new Date(r.processedAt).toLocaleDateString("de-DE") : "Pending"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !errorMsg && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-[#6B7280]">No payout runs yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top providers by payout */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#2B3441]">Top Earners</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Cumulative payouts by provider</p>
          </div>
          <div className="divide-y divide-gray-50">
            {byProvider.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#EDF5F0] text-[#2D7A5F] text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium text-[#2B3441]">{p.businessName ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#2D7A5F]">{fmt(p.total)}</p>
                  <p className="text-xs text-[#6B7280]">{p.count} run{p.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
            {byProvider.length === 0 && !errorMsg && (
              <p className="px-6 py-8 text-sm text-center text-[#6B7280]">No payouts yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
