export const dynamic = "force-dynamic"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, jobPosts, payments, notifications, reviews } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, CalendarDays, Clock, CheckCircle2, BellRing } from "lucide-react"
import { DashboardActions } from "@/components/customer/DashboardActions"
import { DashboardBookings } from "@/components/customer/DashboardBookings"
import { DashboardJobs } from "@/components/customer/DashboardJobs"
import { DashboardPayments } from "@/components/customer/DashboardPayments"
import { DashboardNotifications } from "@/components/customer/DashboardNotifications"

export default async function CustomerDashboardPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect("/sign-in")
  const uid = userId as string
  const user = await currentUser()
  const jwtRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  const role = jwtRole ?? (user?.publicMetadata?.role as string | undefined)
  if (role === "provider") redirect("/provider/dashboard")
  if (role === "admin") redirect("/admin/dashboard")
  // No redirect for missing role — middleware already verified access

  const [allBookings, recentJobs, recentPayments, recentNotifs, reviewedRows] = await Promise.all([
    db.query.bookings.findMany({
      where: (b) => eq(b.customerId, uid),
      with: {
        provider: { columns: { businessName: true, slug: true, city: true } },
        service:  { columns: { name: true, basePrice: true } },
      },
      orderBy: [desc(bookings.createdAt)],
      limit: 20,
    }).catch(() => [] as never[]),

    db.query.jobPosts.findMany({
      where: (jp) => eq(jp.customerId, uid),
      with: {
        bids:     { columns: { id: true, status: true } },
        category: { columns: { name: true } },
      },
      orderBy: [desc(jobPosts.createdAt)],
      limit: 5,
    }).catch(() => [] as never[]),

    db.select({ id: payments.id, status: payments.status, amount: payments.amount, currency: payments.currency, createdAt: payments.createdAt })
      .from(payments)
      .where(eq(payments.customerId, uid))
      .orderBy(desc(payments.createdAt))
      .limit(5)
      .catch(() => [] as never[]),

    db.query.notifications.findMany({
      where: (n) => eq(n.userId, uid),
      orderBy: [desc(notifications.createdAt)],
      limit: 6,
    }).catch(() => [] as never[]),

    db.select({ bookingId: reviews.bookingId })
      .from(reviews)
      .where(eq(reviews.customerId, uid))
      .catch(() => [] as never[]),
  ])

  const reviewedBookingIds = reviewedRows.map(r => r.bookingId)
  const upcoming       = allBookings.filter(b => ["payment_authorized", "confirmed", "in_progress", "pending_capture"].includes(b.status))
  const past           = allBookings.filter(b => ["completed", "cancelled", "disputed", "refunded"].includes(b.status)).slice(0, 4)
  const pendingPayment = allBookings.filter(b => b.status === "pending_payment")
  const jobsWithBids   = recentJobs.filter(j => j.bids.some(bid => bid.status === "pending") && ["open", "bidding"].includes(j.status))
  const unreadCount    = recentNotifs.filter(n => !n.isRead).length

  const stats = [
    { label: "Total Bookings", value: allBookings.length,                                          icon: CalendarDays },
    { label: "Upcoming",       value: upcoming.length,                                             icon: Clock        },
    { label: "Completed",      value: allBookings.filter(b => b.status === "completed").length,    icon: CheckCircle2 },
    { label: "Unread Alerts",  value: unreadCount,                                                 icon: BellRing     },
  ]

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">
              Welcome back, {user?.firstName ?? "there"} 👋
            </h1>
            <p className="text-[#6B7280] text-sm mt-1">Everything happening with your account</p>
          </div>
          <Link href="/book">
            <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white gap-2">
              <Plus size={16} /> Book a Cleaning
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl border border-[#E5EBF0] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={15} className="text-[#2D7A5F]" />
                <span className="text-xs font-medium text-[#6B7280]">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-[#2B3441]">{s.value}</p>
            </div>
          ))}
        </div>

        <DashboardActions pendingBookings={pendingPayment} jobsWithBids={jobsWithBids} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardBookings upcoming={upcoming} past={past} reviewedBookingIds={reviewedBookingIds} />
          <DashboardJobs jobs={recentJobs} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardPayments payments={recentPayments} />
          <DashboardNotifications notifications={recentNotifs} />
        </div>

      </div>
    </div>
  )
}
