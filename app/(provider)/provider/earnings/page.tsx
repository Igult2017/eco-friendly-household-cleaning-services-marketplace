export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { providers, payouts, bookings, payments } from "@/lib/db/schema"
import { eq, and, sum, count, desc } from "drizzle-orm"

async function getEarningsData(providerId: string) {
  const [totalEarned, pendingPayout, completedJobs, recentPayouts] = await Promise.all([
    db.select({ total: sum(payouts.amount) }).from(payouts).where(and(eq(payouts.providerId, providerId), eq(payouts.status, "paid"))),
    db.select({ total: sum(bookings.providerPayout) }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "completed"))),
    db.select({ count: count() }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "completed"))),
    db.select({ id: payouts.id, amount: payouts.amount, status: payouts.status, periodStart: payouts.periodStart, periodEnd: payouts.periodEnd, processedAt: payouts.processedAt }).from(payouts).where(eq(payouts.providerId, providerId)).orderBy(desc(payouts.processedAt)).limit(10),
  ])

  return {
    totalEarned: Number(totalEarned[0]?.total ?? 0),
    pendingPayout: Number(pendingPayout[0]?.total ?? 0),
    completedJobs: Number(completedJobs[0]?.count ?? 0),
    recentPayouts,
  }
}

export default async function EarningsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/profile")

  const data = await getEarningsData(provider.id)

  const kpis = [
    { label: "Total earned", value: `€${(data.totalEarned / 100).toFixed(2)}`, sub: "All time" },
    { label: "Pending payout", value: `€${(data.pendingPayout / 100).toFixed(2)}`, sub: "Next Monday" },
    { label: "Jobs completed", value: data.completedJobs, sub: "All time" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Earnings</h1>
        <p className="text-sm text-[#6B7280] mt-1">Your payout history and upcoming earnings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-white shadow-sm p-6">
            <p className="text-xs uppercase tracking-widest font-semibold text-[#6B7280]">{k.label}</p>
            <p className="text-4xl font-bold text-[#2B3441] mt-1">{k.value}</p>
            <p className="text-xs text-[#6B7280] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2B3441]">Payout History</h2>
        </div>
        {data.recentPayouts.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#6B7280]">No payouts yet. Complete jobs to start earning.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Period", "Amount", "Status", "Processed"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.recentPayouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm text-[#6B7280]">
                    {p.periodStart ? `${new Date(p.periodStart).toLocaleDateString("de-DE")} – ${p.periodEnd ? new Date(p.periodEnd).toLocaleDateString("de-DE") : ""}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[#2B3441]">€{((p.amount ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${p.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#6B7280]">
                    {p.processedAt ? new Date(p.processedAt).toLocaleDateString("de-DE") : "Pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
