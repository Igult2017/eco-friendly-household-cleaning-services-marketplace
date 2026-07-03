export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, providers, providerServices } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { zonedDayAndTime } from "@/lib/utils/tz"
import { RecurringSetupForm } from "@/components/booking/RecurringSetupForm"
import { BackButton } from "@/components/ui/BackButton"

export const metadata = { title: "Set up recurring | DORIXÉ" }

// Pre-fills the recurring schedule from the booking the client just made (provider, service, address,
// frequency, day/time) so the stated intent becomes a live schedule with one consent step.
export default async function RecurringNewPage({ searchParams }: { searchParams: Promise<{ bookingId?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const { bookingId } = await searchParams
  if (!bookingId) redirect("/recurring")

  const [b] = await db
    .select({
      providerId: bookings.providerId,
      serviceId: bookings.serviceId,
      serviceAddress: bookings.serviceAddress,
      ecoOptions: bookings.ecoOptionsSelected,
      specialInstructions: bookings.specialInstructions,
      requestedFrequency: bookings.requestedFrequency,
      scheduledAt: bookings.scheduledAt,
      businessName: providers.businessName,
      timezone: providers.timezone,
      serviceName: providerServices.name,
    })
    .from(bookings)
    .innerJoin(providers, eq(bookings.providerId, providers.id))
    .innerJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, userId)))

  if (!b || !b.providerId || !b.serviceId) redirect("/recurring")

  const tz = b.timezone || "Europe/Amsterdam"
  const { dayOfWeek, hhmm } = zonedDayAndTime(new Date(b.scheduledAt), tz)
  const freq = (["weekly", "biweekly", "monthly"] as const).includes(b.requestedFrequency as never)
    ? (b.requestedFrequency as "weekly" | "biweekly" | "monthly")
    : "weekly"

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pt-6"><BackButton fallback="/bookings" /></div>
      <RecurringSetupForm
      providerId={b.providerId}
      serviceId={b.serviceId}
      businessName={b.businessName}
      serviceName={b.serviceName}
      serviceAddress={(b.serviceAddress as Record<string, unknown>) ?? {}}
      ecoOptions={(b.ecoOptions as string[]) ?? []}
      specialInstructions={b.specialInstructions ?? ""}
      timezone={tz}
      initialFrequency={freq}
      initialDayOfWeek={dayOfWeek}
      initialTime={hhmm}
      />
    </>
  )
}
