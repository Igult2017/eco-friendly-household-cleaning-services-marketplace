import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { recurringSchedules, providers, providerServices } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { RefreshCw, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RecurringScheduleCard } from "@/components/booking/RecurringScheduleCard"

export const metadata = { title: "Recurring Bookings | DORIX" }

export default async function RecurringPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const schedules = await db
    .select({
      id: recurringSchedules.id,
      frequency: recurringSchedules.frequency,
      nextBookingAt: recurringSchedules.nextBookingAt,
      status: recurringSchedules.status,
      providerBusinessName: providers.businessName,
      serviceName: providerServices.name,
    })
    .from(recurringSchedules)
    .innerJoin(providers, eq(recurringSchedules.providerId, providers.id))
    .innerJoin(providerServices, eq(recurringSchedules.serviceId, providerServices.id))
    .where(eq(recurringSchedules.customerId, userId))

  const active = schedules.filter((s) => s.status === "active")
  const paused = schedules.filter((s) => s.status === "paused")
  const cancelled = schedules.filter((s) => s.status === "cancelled")

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441] flex items-center gap-2">
              <RefreshCw size={22} className="text-[#2D7A5F]" />
              Recurring Bookings
            </h1>
            <p className="text-[#6B7280] text-sm mt-1">Your automated cleaning schedules</p>
          </div>
          <Link href="/book">
            <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white gap-2">
              <Plus size={16} /> New Booking
            </Button>
          </Link>
        </div>

        {schedules.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E5EBF0]">
            <RefreshCw size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">No recurring schedules</h2>
            <p className="text-[#6B7280] mb-6">Set up a recurring cleaning when booking a service</p>
            <Link href="/book">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">Book a Cleaning</Button>
            </Link>
          </div>
        )}

        {active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#2B3441] uppercase tracking-wide mb-3">Active</h2>
            <div className="space-y-4">
              {active.map((s) => (
                <RecurringScheduleCard
                  key={s.id}
                  scheduleId={s.id}
                  businessName={s.providerBusinessName}
                  serviceName={s.serviceName}
                  frequency={s.frequency}
                  nextBookingAt={s.nextBookingAt ? s.nextBookingAt.toISOString() : null}
                  status={s.status}
                />
              ))}
            </div>
          </section>
        )}

        {paused.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Paused</h2>
            <div className="space-y-4">
              {paused.map((s) => (
                <RecurringScheduleCard
                  key={s.id}
                  scheduleId={s.id}
                  businessName={s.providerBusinessName}
                  serviceName={s.serviceName}
                  frequency={s.frequency}
                  nextBookingAt={s.nextBookingAt ? s.nextBookingAt.toISOString() : null}
                  status={s.status}
                />
              ))}
            </div>
          </section>
        )}

        {cancelled.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Cancelled</h2>
            <div className="space-y-4">
              {cancelled.map((s) => (
                <RecurringScheduleCard
                  key={s.id}
                  scheduleId={s.id}
                  businessName={s.providerBusinessName}
                  serviceName={s.serviceName}
                  frequency={s.frequency}
                  nextBookingAt={s.nextBookingAt ? s.nextBookingAt.toISOString() : null}
                  status={s.status}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
