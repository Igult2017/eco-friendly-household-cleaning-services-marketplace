export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { db } from "@/lib/db"
import { bookings, providers, providerServices } from "@/lib/db/schema"
import { eq, and, gte, inArray, desc } from "drizzle-orm"
import { ProviderCalendar } from "@/components/provider/ProviderCalendar"

export default async function CustomerCalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("providerCalendarPage")
  const locale = await getLocale()

  const since = new Date()
  since.setMonth(since.getMonth() - 3)

  const rows = await db
    .select({
      id: bookings.id,
      scheduledAt: bookings.scheduledAt,
      status: bookings.status,
      tz: providers.timezone,
      businessName: providers.businessName,
      serviceName: providerServices.name,
    })
    .from(bookings)
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .where(
      and(
        eq(bookings.customerId, userId),
        gte(bookings.scheduledAt, since),
        inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture", "completed", "cancelled", "disputed"])
      )
    )
    .orderBy(desc(bookings.scheduledAt))
    .limit(300)
    .catch(() => [])

  // Each booking happens at the cleaner's location → render its day/time in THAT provider's timezone.
  const events = rows.map((b) => {
    const tz = b.tz || "Europe/Berlin"
    const d = new Date(b.scheduledAt)
    const [y, mo, day] = d.toLocaleDateString("en-CA", { timeZone: tz }).split("-").map(Number)
    return {
      id: b.id,
      y, m: mo - 1, d: day,
      label: b.businessName || b.serviceName || t("booking"),
      time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }),
      status: b.status,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subheading")}</p>
      </div>
      <ProviderCalendar events={events} linkBase="/bookings" perEvent />
    </div>
  )
}
