import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, providers, providerServices } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { RescheduleForm } from "@/components/booking/RescheduleForm"

export const dynamic = "force-dynamic"

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const [booking] = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      providerBusinessName: providers.businessName,
      serviceName: providerServices.name,
    })
    .from(bookings)
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)))

  if (!booking) notFound()

  const canReschedule = ["payment_authorized", "confirmed"].includes(booking.status)
  if (!canReschedule) redirect(`/bookings/${id}`)

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link
          href={`/bookings/${id}`}
          className="inline-flex items-center text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors mb-6"
        >
          ← Back to booking
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-[#E5EBF0] p-6">
          <div className="flex items-center gap-3 mb-2">
            <CalendarClock size={22} className="text-[#2D7A5F]" />
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Reschedule Booking</h1>
          </div>

          <p className="text-sm text-[#6B7280] mb-6">
            <span className="font-medium text-[#2B3441]">{booking.serviceName ?? "Cleaning Service"}</span>
            {booking.providerBusinessName ? ` · ${booking.providerBusinessName}` : ""}
            <span className="ml-2 text-xs text-[#9CA3AF]">{booking.bookingNumber}</span>
          </p>

          <RescheduleForm
            bookingId={id}
            currentScheduledAt={booking.scheduledAt.toISOString()}
          />
        </div>
      </div>
    </div>
  )
}
