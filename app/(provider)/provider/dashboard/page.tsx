export const dynamic = "force-dynamic"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, providers } from "@/lib/db/schema"
import { eq, desc, and, inArray } from "drizzle-orm"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, CheckCircle2, Clock, Star, TrendingUp, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  payment_authorized: { label: "Upcoming", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", color: "bg-[#D1F0E0] text-[#2D7A5F]" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
  disputed: { label: "Disputed", color: "bg-orange-100 text-orange-700" },
}

export default async function ProviderDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()

  const [provider] = await db
    .select({ id: providers.id, businessName: providers.businessName, averageRating: providers.averageRating, totalReviews: providers.totalReviews, totalJobsCompleted: providers.totalJobsCompleted, isApproved: providers.isApproved, ecoLevel: providers.ecoLevel })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) redirect("/onboarding/provider")

  const providerBookings = await db.query.bookings.findMany({
    where: (b) => eq(b.providerId, provider.id),
    with: {
      customer: { columns: { firstName: true, lastName: true, email: true } },
      service: { columns: { name: true, basePrice: true } },
    },
    orderBy: [desc(bookings.scheduledAt)],
    limit: 30,
  })

  const upcoming = providerBookings.filter((b) => ["payment_authorized", "confirmed", "in_progress"].includes(b.status))
  const completed = providerBookings.filter((b) => b.status === "completed")
  const totalEarnings = completed.reduce((sum, b) => sum + b.providerPayout, 0)

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">
              {provider.businessName}
            </h1>
            <p className="text-[#6B7280] text-sm mt-1">Provider Dashboard</p>
          </div>
          {!provider.isApproved && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-700">
              <AlertCircle size={16} />
              Pending admin approval
            </div>
          )}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Earnings", value: formatCurrency(totalEarnings), icon: TrendingUp },
            { label: "Jobs Done", value: provider.totalJobsCompleted, icon: CheckCircle2 },
            { label: "Avg Rating", value: provider.averageRating ? `${Number(provider.averageRating).toFixed(1)} ⭐` : "—", icon: Star },
            { label: "Upcoming", value: upcoming.length, icon: CalendarDays },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EBF0]">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={15} className="text-[#2D7A5F]" />
                <span className="text-xs text-[#6B7280] font-medium">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-[#2B3441]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Upcoming jobs */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold text-[#2B3441] mb-3 flex items-center gap-2">
              <Clock size={17} className="text-[#2D7A5F]" /> Upcoming Jobs
            </h2>
            <div className="space-y-3">
              {upcoming.map((b) => {
                const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.confirmed
                const customerName = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || "Customer"
                return (
                  <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#2B3441]">{b.service?.name ?? "Cleaning"}</p>
                        <p className="text-sm text-[#6B7280]">for {customerName}</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">{formatDate(b.scheduledAt)}</p>
                        <p className="text-xs text-[#9CA3AF]">{b.serviceAddress.line1}, {b.serviceAddress.city}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                        <Badge className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
                        <p className="text-sm font-bold text-[#2D7A5F]">{formatCurrency(b.providerPayout)}</p>
                        <Link href={`/bookings/${b.id}/complete`}>
                          <Button size="sm" className="bg-[#2D7A5F] hover:bg-[#235f49] text-white text-xs h-8">
                            Mark Complete
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Recent completed */}
        {completed.length > 0 && (
          <section>
            <h2 className="font-semibold text-[#2B3441] mb-3 flex items-center gap-2">
              <CheckCircle2 size={17} className="text-[#6B7280]" /> Completed Jobs
            </h2>
            <div className="space-y-3">
              {completed.slice(0, 10).map((b) => {
                const customerName = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || "Customer"
                return (
                  <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-4 opacity-80">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#2B3441]">{b.service?.name ?? "Cleaning"}</p>
                        <p className="text-sm text-[#6B7280]">for {customerName}</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">{formatDate(b.scheduledAt)}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-700 text-xs mb-1">Completed</Badge>
                        <p className="text-sm font-bold text-[#2B3441]">{formatCurrency(b.providerPayout)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {providerBookings.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E5EBF0]">
            <CalendarDays size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">No bookings yet</h2>
            <p className="text-[#6B7280]">Bookings from customers will appear here once your profile is approved</p>
          </div>
        )}
      </div>
    </div>
  )
}
