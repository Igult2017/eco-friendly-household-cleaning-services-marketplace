export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { db } from "@/lib/db"
import { bookings, reviews } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { DashboardBookings } from "@/components/customer/DashboardBookings"

export default async function CustomerBookingsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("customerLayout")
  const tCal = await getTranslations("providerCalendarPage")

  const [allBookings, reviewedRows] = await Promise.all([
    db.query.bookings
      .findMany({
        where: (b) => eq(b.customerId, userId),
        with: {
          provider: { columns: { businessName: true } },
          service: { columns: { name: true } },
        },
        orderBy: [desc(bookings.createdAt)],
        limit: 200,
      })
      .catch(() => [] as never[]),
    db.select({ bookingId: reviews.bookingId }).from(reviews).where(eq(reviews.customerId, userId)).catch(() => []),
  ])

  const reviewedBookingIds = reviewedRows.map((r) => r.bookingId)
  const list = allBookings as Array<{ status: string; scheduledAt: Date | string }>
  // pending_payment needs the client's action right now (add a payment method) — it belongs with
  // the actionable bookings, not filed away with completed/cancelled/refunded history where it's
  // easy to miss the very thing blocking the cleaner from taking the job.
  const upcoming = list
    .filter((b) => ["pending_payment", "payment_authorized", "confirmed", "in_progress", "pending_capture"].includes(b.status))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const past = list.filter((b) => ["completed", "cancelled", "disputed", "refunded", "client_no_show", "cleaner_no_show"].includes(b.status))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("navBookings")}</h1>
        <Link href="/calendar" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2D7A5F] hover:underline">
          <CalendarDays size={15} /> {tCal("heading")}
        </Link>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DashboardBookings upcoming={upcoming as any} past={past as any} reviewedBookingIds={reviewedBookingIds} limit={200} />
    </div>
  )
}
