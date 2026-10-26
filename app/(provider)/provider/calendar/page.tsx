export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq, gte, inArray } from "drizzle-orm"
import { ProviderCalendar } from "@/components/provider/ProviderCalendar"
import { projectRecurringDates } from "@/lib/bookings/recurringProjection"

export default async function ProviderCalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("providerCalendarPage")

  const [provider] = await db
    .select({ id: providers.id, timezone: providers.timezone })
    .from(providers)
    .where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/profile")

  // From ~3 months back onward — enough history to page back, plus all upcoming jobs.
  const since = new Date()
  since.setMonth(since.getMonth() - 3)

  const rows = await db.query.bookings
    .findMany({
      where: (b, { and: a }) =>
        a(
          eq(b.providerId, provider.id),
          gte(b.scheduledAt, since),
          inArray(b.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture", "completed", "cancelled", "disputed"])
        ),
      with: {
        customer: { columns: { firstName: true, lastName: true } },
        service: { columns: { name: true } },
      },
      orderBy: (b, { asc }) => [asc(b.scheduledAt)],
      limit: 300,
    })
    .catch(() => [] as never[])

  const tz = provider.timezone || "Europe/Berlin"
  const locale = await getLocale()
  const events = (rows as Array<{ id: string; scheduledAt: Date | string; status: string; customer: { firstName: string | null; lastName: string | null } | null; service: { name: string | null } | null }>).map((b) => {
    const d = new Date(b.scheduledAt)
    // Bucket by the booking's day in the CLEANER's timezone (not the server/browser local day).
    const [y, mo, day] = d.toLocaleDateString("en-CA", { timeZone: tz }).split("-").map(Number)
    const name = [b.customer?.firstName, b.customer?.lastName?.[0]].filter(Boolean).join(" ")
    return {
      id: b.id,
      y, m: mo - 1, d: day,
      label: name || b.service?.name || t("booking"),
      time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }),
      status: b.status,
    }
  })

  // A cleaner needs to see the recurring work they have committed to in order to plan their week.
  // Recurring cleanings only become real bookings a day before they happen, so until now only the
  // very next one was visible here. Projected, never booked — nothing is charged for these.
  const planned = await projectRecurringDates({
    providerId: provider.id,
    excludeTimes: (rows as Array<{ scheduledAt: Date | string }>).map((b) => new Date(b.scheduledAt)),
  }).catch(() => [])

  const plannedEvents = planned.map((p) => {
    const [y, mo, day] = p.at.toLocaleDateString("en-CA", { timeZone: tz }).split("-").map(Number)
    return {
      id: `planned-${p.scheduleId}-${p.at.getTime()}`,
      y, m: mo - 1, d: day,
      label: t("booking"),
      time: p.at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }),
      status: "planned",
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subheading")}</p>
      </div>
      <ProviderCalendar events={[...events, ...plannedEvents]} />
    </div>
  )
}
