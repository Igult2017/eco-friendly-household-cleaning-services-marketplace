import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Plus, Star, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment: { label: "Pending Payment", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  payment_authorized: { label: "Confirmed", color: "bg-blue-100 text-blue-700", icon: CalendarDays },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700", icon: CalendarDays },
  in_progress: { label: "In Progress", color: "bg-[#D1F0E0] text-[#2D7A5F]", icon: Clock },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: AlertCircle },
  disputed: { label: "Disputed", color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  refunded: { label: "Refunded", color: "bg-gray-100 text-gray-600", icon: CheckCircle2 },
}

export default async function CustomerDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()

  const customerBookings = await db.query.bookings.findMany({
    where: (b) => eq(b.customerId, userId),
    with: {
      provider: { columns: { businessName: true, slug: true, profilePhotoUrl: true, city: true } },
      service: { columns: { name: true, basePrice: true } },
    },
    orderBy: [desc(bookings.createdAt)],
    limit: 20,
  })

  const upcoming = customerBookings.filter((b) => ["payment_authorized", "confirmed", "in_progress"].includes(b.status))
  const past = customerBookings.filter((b) => ["completed", "cancelled", "disputed", "refunded"].includes(b.status))

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">
              Welcome back, {user?.firstName ?? "there"} 👋
            </h1>
            <p className="text-[#6B7280] text-sm mt-1">Manage your cleaning bookings</p>
          </div>
          <Link href="/book">
            <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white gap-2">
              <Plus size={16} /> Book a Cleaning
            </Button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Bookings", value: customerBookings.length, icon: CalendarDays },
            { label: "Upcoming", value: upcoming.length, icon: Clock },
            { label: "Completed", value: customerBookings.filter((b) => b.status === "completed").length, icon: CheckCircle2 },
            { label: "Eco Sessions", value: customerBookings.filter((b) => (b.ecoOptionsSelected ?? []).length > 0).length, icon: Star },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EBF0]">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={15} className="text-[#2D7A5F]" />
                <span className="text-xs text-[#6B7280] font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-[#2B3441]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Upcoming bookings */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold text-[#2B3441] mb-3 flex items-center gap-2">
              <CalendarDays size={17} className="text-[#2D7A5F]" />
              Upcoming Bookings
            </h2>
            <div className="space-y-3">
              {upcoming.map((b) => {
                const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.confirmed
                return (
                  <Link key={b.id} href={`/bookings/${b.id}`} className="block">
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-4 hover:border-[#4CB87A] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#2B3441]">{b.service?.name ?? "Cleaning Service"}</p>
                          <p className="text-sm text-[#6B7280]">with {b.provider?.businessName}</p>
                          <p className="text-xs text-[#9CA3AF] mt-1">{formatDate(b.scheduledAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Badge className={cn("text-xs mb-2", cfg.color)}>
                            {cfg.label}
                          </Badge>
                          <p className="text-sm font-bold text-[#2D7A5F]">{formatCurrency(b.totalAmount)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-[#9CA3AF] mt-2">{b.bookingNumber}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Past bookings */}
        {past.length > 0 && (
          <section>
            <h2 className="font-semibold text-[#2B3441] mb-3 flex items-center gap-2">
              <Clock size={17} className="text-[#6B7280]" />
              Past Bookings
            </h2>
            <div className="space-y-3">
              {past.map((b) => {
                const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.completed
                return (
                  <Link key={b.id} href={`/bookings/${b.id}`} className="block">
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-4 hover:border-[#E5EBF0] transition-colors opacity-80 hover:opacity-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#2B3441]">{b.service?.name ?? "Cleaning Service"}</p>
                          <p className="text-sm text-[#6B7280]">with {b.provider?.businessName}</p>
                          <p className="text-xs text-[#9CA3AF] mt-1">{formatDate(b.scheduledAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Badge className={cn("text-xs mb-2", cfg.color)}>
                            {cfg.label}
                          </Badge>
                          <p className="text-sm font-bold text-[#2B3441]">{formatCurrency(b.totalAmount)}</p>
                        </div>
                      </div>
                      {b.status === "completed" && (
                        <Link
                          href={`/bookings/${b.id}/review`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-[#2D7A5F] font-medium hover:underline"
                        >
                          <Star size={12} /> Leave a review
                        </Link>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {customerBookings.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E5EBF0]">
            <CalendarDays size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">No bookings yet</h2>
            <p className="text-[#6B7280] mb-6">Book your first eco-friendly cleaning today</p>
            <Link href="/book">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">Book a Cleaning</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
