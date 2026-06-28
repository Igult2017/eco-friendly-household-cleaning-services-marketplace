export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { payments, payouts, users, providers } from "@/lib/db/schema"
import { eq, desc, sum, count } from "drizzle-orm"
import { StatusBadge } from "@/components/admin/StatusBadge"

export default async function AdminPaymentsPage() {

  const recentPayments = await db
    .select({
      id: payments.id,
      stripePaymentIntentId: payments.stripePaymentIntentId,
      status: payments.status,
      amount: payments.amount,
      capturedAmount: payments.capturedAmount,
      refundedAmount: payments.refundedAmount,
      currency: payments.currency,
      capturedAt: payments.capturedAt,
      createdAt: payments.createdAt,
      customerEmail: users.email,
    })
    .from(payments)
    .leftJoin(users, eq(payments.customerId, users.id))
    .orderBy(desc(payments.createdAt))
    .limit(50)

  const recentPayouts = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      status: payouts.status,
      processedAt: payouts.processedAt,
      businessName: providers.businessName,
    })
    .from(payouts)
    .leftJoin(providers, eq(payouts.providerId, providers.id))
    .orderBy(desc(payouts.processedAt))
    .limit(20)

  const [totals] = await db.select({ total: sum(payments.capturedAmount), count: count() }).from(payments).where(eq(payments.status, "captured"))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Payments</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {Number(totals?.count ?? 0)} captured payments · Total GMV €{(Number(totals?.total ?? 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Payment ledger */}
        <div className="xl:col-span-2 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#2B3441]">Payment Ledger</h2>
          </div>
          <div className="overflow-x-auto">
            <div className="overflow-x-auto -mx-px"><table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {["Customer", "Intent ID", "Amount", "Captured", "Refunded", "Status", "Date"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-xs text-[#6B7280]">{p.customerEmail ?? "—"}</td>
                    <td className="px-3 py-3 text-xs font-mono text-[#6B7280] truncate max-w-24">{p.stripePaymentIntentId.slice(-12)}</td>
                    <td className="px-3 py-3 text-sm font-medium text-[#2B3441]">€{((p.amount ?? 0) / 100).toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-[#2D7A5F] font-medium">€{((p.capturedAmount ?? 0) / 100).toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-[#6B7280]">€{((p.refundedAmount ?? 0) / 100).toFixed(2)}</td>
                    <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-3 text-xs text-[#6B7280] whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString("de-DE")}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>

        {/* Recent Payouts */}
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#2B3441]">Recent Payouts</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentPayouts.map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#2B3441]">{p.businessName ?? "—"}</p>
                  <p className="text-xs text-[#6B7280]">{p.processedAt ? new Date(p.processedAt).toLocaleDateString("de-DE") : "Pending"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#2B3441]">€{((p.amount ?? 0) / 100).toFixed(2)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
            {recentPayouts.length === 0 && <p className="px-6 py-8 text-sm text-center text-[#6B7280]">No payouts yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
