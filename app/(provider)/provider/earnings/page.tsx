export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { db } from "@/lib/db"
import { providers, payouts, bookings, payments } from "@/lib/db/schema"
import { eq, and, sum, count, desc, gte, lt, inArray } from "drizzle-orm"
import { PayoutConnect } from "@/components/provider/PayoutConnect"
import { getConnectAccountStatus } from "@/lib/stripe/connect"

async function getEarningsData(providerId: string) {
  const now = new Date()
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1)
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const startNext = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const startAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1)

  const [totalEarned, pendingPayout, completedJobs, recentPayouts, prevMonth, thisMonth, estNext] = await Promise.all([
    db.select({ total: sum(payouts.amount) }).from(payouts).where(and(eq(payouts.providerId, providerId), eq(payouts.status, "paid"))),
    db.select({ total: sum(bookings.providerPayout) }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "completed"))),
    db.select({ count: count() }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "completed"))),
    db.select({ id: payouts.id, amount: payouts.amount, status: payouts.status, periodStart: payouts.periodStart, periodEnd: payouts.periodEnd, processedAt: payouts.processedAt }).from(payouts).where(eq(payouts.providerId, providerId)).orderBy(desc(payouts.processedAt)).limit(10),
    db.select({ total: sum(bookings.providerPayout) }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "completed"), gte(bookings.scheduledAt, startPrev), lt(bookings.scheduledAt, startThis))),
    db.select({ total: sum(bookings.providerPayout) }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "completed"), gte(bookings.scheduledAt, startThis), lt(bookings.scheduledAt, startNext))),
    db.select({ total: sum(bookings.providerPayout) }).from(bookings).where(and(eq(bookings.providerId, providerId), inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture"]), gte(bookings.scheduledAt, startNext), lt(bookings.scheduledAt, startAfterNext))),
  ])

  return {
    totalEarned: Number(totalEarned[0]?.total ?? 0),
    pendingPayout: Number(pendingPayout[0]?.total ?? 0),
    completedJobs: Number(completedJobs[0]?.count ?? 0),
    recentPayouts,
    prevMonthEarned: Number(prevMonth[0]?.total ?? 0),
    thisMonthEarned: Number(thisMonth[0]?.total ?? 0),
    estNextEarned: Number(estNext[0]?.total ?? 0),
  }
}

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db.select({ id: providers.id, stripeAccountId: providers.stripeAccountId, stripeAccountStatus: providers.stripeAccountStatus }).from(providers).where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/profile")

  // Returning from Stripe Connect onboarding — refresh status live so it flips to "active"
  // immediately, without depending on the account.updated webhook being configured in Stripe.
  let payoutStatus = provider.stripeAccountStatus
  const sp = await searchParams
  if ((sp.connect === "success" || sp.connect === "refresh") && provider.stripeAccountId) {
    try {
      const fresh = await getConnectAccountStatus(provider.stripeAccountId)
      if (fresh !== provider.stripeAccountStatus) {
        await db.update(providers).set({ stripeAccountStatus: fresh }).where(eq(providers.id, provider.id))
      }
      payoutStatus = fresh
    } catch (e) {
      console.warn("[earnings] connect status refresh failed:", e)
    }
  }

  const data = await getEarningsData(provider.id)

  const t = await getTranslations("providerProviderEarningsPage")
  const locale = await getLocale()
  const now = new Date()
  const monthName = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString(locale, { month: "long" })

  const periods = [
    { label: t("periodPrevious", { month: monthName(-1) }), value: data.prevMonthEarned, accent: false, sub: "" },
    { label: t("periodCurrent", { month: monthName(0) }), value: data.thisMonthEarned, accent: true, sub: "" },
    { label: t("periodEstimated", { month: monthName(1) }), value: data.estNextEarned, accent: false, sub: t("periodEstimatedSub") },
  ]

  const kpis = [
    { label: t("kpiTotalEarned"), value: `€${(data.totalEarned / 100).toFixed(2)}`, sub: t("kpiAllTime") },
    { label: t("kpiPendingPayout"), value: `€${(data.pendingPayout / 100).toFixed(2)}`, sub: t("kpiNextMonday") },
    { label: t("kpiJobsCompleted"), value: data.completedJobs, sub: t("kpiAllTime") },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subheading")}</p>
      </div>

      {/* Payout setup — a cleaner can't be paid until Stripe Connect is active. */}
      <PayoutConnect status={payoutStatus} />

      {/* Monthly breakdown — previous / current / estimated next month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {periods.map((p) => (
          <div key={p.label} className={`rounded-xl p-6 shadow-sm ${p.accent ? "bg-[#2D7A5F] text-white" : "bg-white"}`}>
            <p className={`text-xs font-medium ${p.accent ? "text-white/80" : "text-[#6B7280]"}`}>{p.label}</p>
            <p className={`text-3xl font-bold mt-1 ${p.accent ? "text-white" : "text-[#2B3441]"}`}>€{(p.value / 100).toFixed(2)}</p>
            {p.sub && <p className={`text-xs mt-0.5 ${p.accent ? "text-white/70" : "text-[#9CA3AF]"}`}>{p.sub}</p>}
          </div>
        ))}
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
          <h2 className="font-semibold text-[#2B3441]">{t("payoutHistoryTitle")}</h2>
        </div>
        {data.recentPayouts.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#6B7280]">{t("emptyState")}</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[t("colPeriod"), t("colAmount"), t("colStatus"), t("colProcessed")].map((h) => (
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
                      {p.status === "paid" ? t("statusPaid") : t("statusPending")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#6B7280]">
                    {p.processedAt ? new Date(p.processedAt).toLocaleDateString("de-DE") : t("processedPending")}
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
