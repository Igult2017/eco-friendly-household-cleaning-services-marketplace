export const dynamic = "force-dynamic"

import { KpiCard } from "@/components/admin/KpiCard"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { db } from "@/lib/db"
import { bookings, disputes, payments, providers, users } from "@/lib/db/schema"
import { eq, count, sum, sql, and, desc, gte } from "drizzle-orm"
import {
  TrendingUp,
  CalendarCheck,
  MessageSquareWarning,
  UserCheck,
  Users,
  Briefcase,
} from "lucide-react"
import Link from "next/link"

async function getStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    [gmvRow],
    [activeRow],
    [disputesRow],
    [pendingRow],
    [customersRow],
    [approvedRow],
    recentBookings,
    recentDisputes,
    bookingsByDay,
    [cancellationRow],
    topProviders,
    allCustomerBookings,
  ] = await Promise.all([
    db.select({ total: sum(payments.capturedAmount) }).from(payments).where(eq(payments.status, "captured")),
    db.select({ count: count() }).from(bookings).where(sql`${bookings.status} IN ('confirmed','in_progress','payment_authorized')`),
    db.select({ count: count() }).from(disputes).where(sql`${disputes.status} IN ('open','under_review','escalated')`),
    db.select({ count: count() }).from(providers).where(and(eq(providers.isApproved, false), eq(providers.isSuspended, false))),
    db.select({ count: count() }).from(users).where(eq(users.role, "customer")),
    db.select({ count: count() }).from(providers).where(eq(providers.isApproved, true)),
    db.select({ id: bookings.id, bookingNumber: bookings.bookingNumber, status: bookings.status, totalAmount: bookings.totalAmount, createdAt: bookings.createdAt })
      .from(bookings).orderBy(desc(bookings.createdAt)).limit(5),
    db.select({ id: disputes.id, reason: disputes.reason, status: disputes.status, createdAt: disputes.createdAt })
      .from(disputes).where(sql`${disputes.status} IN ('open','escalated')`).orderBy(desc(disputes.createdAt)).limit(5),
    db.select({ day: sql<string>`DATE(${bookings.createdAt})`, cnt: count(), gmv: sum(bookings.totalAmount) })
      .from(bookings).where(gte(bookings.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${bookings.createdAt})`).orderBy(sql`DATE(${bookings.createdAt})`),
    db.select({
      total: count(),
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'cancelled')`,
    }).from(bookings),
    db.select({
      businessName: providers.businessName,
      totalEarnings: sum(bookings.providerPayout),
    })
      .from(bookings)
      .innerJoin(providers, eq(bookings.providerId, providers.id))
      .where(and(eq(bookings.status, "completed"), gte(bookings.createdAt, thirtyDaysAgo)))
      .groupBy(providers.id, providers.businessName)
      .orderBy(desc(sum(bookings.providerPayout)))
      .limit(3),
    db.select({ customerId: bookings.customerId, bookingCount: count() })
      .from(bookings)
      .groupBy(bookings.customerId),
  ])

  const totalBookings = Number(cancellationRow?.total ?? 0)
  const cancelledCount = Number(cancellationRow?.cancelled ?? 0)
  const cancellationRate = totalBookings > 0 ? (cancelledCount / totalBookings) * 100 : 0
  const repeats = allCustomerBookings.filter(c => Number(c.bookingCount) >= 2).length
  const repeatCustomerRate = allCustomerBookings.length > 0 ? (repeats / allCustomerBookings.length) * 100 : 0

  return {
    gmv: Number(gmvRow?.total ?? 0),
    activeBookings: Number(activeRow?.count ?? 0),
    openDisputes: Number(disputesRow?.count ?? 0),
    pendingProviders: Number(pendingRow?.count ?? 0),
    totalCustomers: Number(customersRow?.count ?? 0),
    totalProviders: Number(approvedRow?.count ?? 0),
    recentBookings,
    recentDisputes,
    bookingsByDay,
    cancellationRate,
    repeatCustomerRate,
    topProviders: topProviders.map(p => ({ businessName: p.businessName ?? "—", totalEarnings: Number(p.totalEarnings ?? 0) })),
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Platform Overview</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Real-time marketplace metrics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <KpiCard
            label="Total GMV"
            value={`€${(stats.gmv / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`}
            sub="All captured payments"
            icon={TrendingUp}
            accent="green"
          />
        </div>
        <KpiCard label="Active Bookings" value={stats.activeBookings} icon={CalendarCheck} accent="blue" />
        <KpiCard label="Open Disputes" value={stats.openDisputes} sub="Needs attention" icon={MessageSquareWarning} accent="red" />
        <KpiCard label="Pending Providers" value={stats.pendingProviders} sub="Awaiting approval" icon={UserCheck} accent="amber" />
        <KpiCard label="Total Customers" value={stats.totalCustomers} icon={Users} accent="blue" />
      </div>

      {/* Two-column tables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Recent Bookings */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#2B3441]">Recent Bookings</h2>
            <Link href="/admin/bookings" className="text-xs text-[#2D7A5F] hover:underline font-medium">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-[#2B3441]">{b.bookingNumber}</p>
                  <p className="text-xs text-[#6B7280]">{new Date(b.createdAt).toLocaleDateString("de-DE")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#2B3441]">
                    €{((b.totalAmount ?? 0) / 100).toFixed(2)}
                  </span>
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
            {stats.recentBookings.length === 0 && (
              <p className="px-6 py-8 text-sm text-center text-[#6B7280]">No bookings yet</p>
            )}
          </div>
        </div>

        {/* Open Disputes */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#2B3441]">Open Disputes</h2>
            <Link href="/admin/disputes" className="text-xs text-[#2D7A5F] hover:underline font-medium">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentDisputes.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-[#2B3441] capitalize">{d.reason.replace(/_/g, " ")}</p>
                  <p className="text-xs text-[#6B7280]">{new Date(d.createdAt).toLocaleDateString("de-DE")}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {stats.recentDisputes.length === 0 && (
              <p className="px-6 py-8 text-sm text-center text-[#6B7280]">No open disputes</p>
            )}
          </div>
        </div>
      </div>

      {/* Business Health */}
      <div>
        <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-4">Business Health</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E5EBF0] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Cancellation Rate</p>
            <p className="mt-1 text-3xl font-bold text-[#2B3441]">{stats.cancellationRate.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">of all bookings</p>
          </div>
          <div className="rounded-xl border border-[#E5EBF0] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Repeat Customers</p>
            <p className="mt-1 text-3xl font-bold text-[#2B3441]">{stats.repeatCustomerRate.toFixed(0)}%</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">have booked 2+ times</p>
          </div>
          <div className="rounded-xl border border-[#E5EBF0] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Top Provider (30d)</p>
            <p className="mt-1 truncate text-xl font-bold text-[#2B3441]">{stats.topProviders[0]?.businessName ?? "—"}</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">€{((stats.topProviders[0]?.totalEarnings ?? 0) / 100).toFixed(0)} earned</p>
          </div>
        </div>
      </div>

      {/* Booking Activity Chart (static sparkline bars) */}
      {stats.bookingsByDay.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm p-6">
          <h2 className="font-semibold text-[#2B3441] mb-4">Booking Activity — Last 30 Days</h2>
          <div className="flex items-end gap-1 h-24">
            {stats.bookingsByDay.map((d, i) => {
              const max = Math.max(...stats.bookingsByDay.map((x) => Number(x.cnt)))
              const pct = max > 0 ? (Number(d.cnt) / max) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full rounded-sm bg-[#2D7A5F] transition-all group-hover:bg-[#4CB87A]"
                    style={{ height: `${Math.max(4, pct)}%` }}
                    title={`${d.day}: ${d.cnt} bookings`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-[#6B7280] mt-2">
            <span>{stats.bookingsByDay[0]?.day}</span>
            <span>{stats.bookingsByDay[stats.bookingsByDay.length - 1]?.day}</span>
          </div>
        </div>
      )}
    </div>
  )
}
