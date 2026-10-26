import { db } from "@/lib/db"
import { recurringSchedules, providers, providerServices } from "@/lib/db/schema"
import { and, eq, isNotNull } from "drizzle-orm"
import { addFrequencyInTZ } from "@/lib/inngest/functions/recurring"

/**
 * The future dates of a recurring cleaning, worked out for the calendar — without booking anything.
 *
 * WHY THIS EXISTS: both calendars read only the `bookings` table, and recurring bookings are
 * created ONE AT A TIME by a daily job that looks just 24 hours ahead
 * (lib/inngest/functions/recurring.ts). So a client who books twice-weekly cleaning saw exactly ONE
 * upcoming date, never the series, and the cleaner saw the same single date — neither side could
 * see the commitment they had made.
 *
 * Creating all the bookings up front would be the wrong fix: every booking carries a real card
 * charge, and that 24-hour window is deliberately there so nobody is charged weeks ahead. So this
 * PROJECTS the dates instead — it reads, and never writes.
 *
 * "Twice weekly" is stored as TWO weekly schedules on different days (one schedule holds one
 * weekday), and "4 times a month" is simply weekly. Walking every schedule handles both with no
 * special cases.
 */

/** How far ahead to show planned cleanings by default. */
const DEFAULT_MONTHS = 3

/**
 * A hard ceiling on dates produced per schedule, whatever the maths says.
 *
 * A schedule whose next date is stuck in the past (a real failure mode the generator itself guards
 * against) would otherwise be walked forward thousands of times on every page load. The horizon
 * below should always stop it first; this is the belt to that pair of braces.
 */
const MAX_PER_SCHEDULE = 60

export type ProjectedDate = {
  scheduleId: string
  at: Date
  timezone: string
  /** Cleaner's business name for a client's calendar, client-side label for a cleaner's. */
  label: string | null
}

export async function projectRecurringDates(opts: {
  customerId?: string
  providerId?: string
  months?: number
  /** Dates that already have a real booking — those are shown as bookings, not as plans. */
  excludeTimes?: Date[]
}): Promise<ProjectedDate[]> {
  if (!opts.customerId && !opts.providerId) return []

  const horizon = new Date()
  horizon.setMonth(horizon.getMonth() + (opts.months ?? DEFAULT_MONTHS))

  const where = [
    eq(recurringSchedules.status, "active"),
    isNotNull(recurringSchedules.nextBookingAt),
    opts.customerId ? eq(recurringSchedules.customerId, opts.customerId) : undefined,
    opts.providerId ? eq(recurringSchedules.providerId, opts.providerId) : undefined,
  ].filter(Boolean)

  const schedules = await db
    .select({
      id: recurringSchedules.id,
      frequency: recurringSchedules.frequency,
      nextBookingAt: recurringSchedules.nextBookingAt,
      timezone: recurringSchedules.timezone,
      businessName: providers.businessName,
      serviceName: providerServices.name,
    })
    .from(recurringSchedules)
    .leftJoin(providers, eq(providers.id, recurringSchedules.providerId))
    .leftJoin(providerServices, eq(providerServices.id, recurringSchedules.serviceId))
    .where(and(...where))
    .catch(() => [])

  // Compared by the minute: a projected time and the booking actually created from it are the same
  // instant, but a stray millisecond or a round-trip through the database should not make the
  // calendar show the same cleaning twice.
  const taken = new Set((opts.excludeTimes ?? []).map(minuteKey))

  const out: ProjectedDate[] = []
  const now = Date.now()

  for (const s of schedules) {
    if (!s.nextBookingAt) continue
    let at = new Date(s.nextBookingAt)

    for (let i = 0; i < MAX_PER_SCHEDULE && at.getTime() <= horizon.getTime(); i++) {
      // A schedule can legitimately be sitting on a past date between the job being due and the
      // daily run picking it up. Skip those rather than drawing yesterday as "planned".
      if (at.getTime() >= now && !taken.has(minuteKey(at))) {
        out.push({
          scheduleId: s.id,
          at,
          timezone: s.timezone || "Europe/Berlin",
          label: s.businessName ?? s.serviceName ?? null,
        })
      }
      at = addFrequencyInTZ(at, s.frequency, s.timezone || "Europe/Berlin")
    }
  }

  return out
}

function minuteKey(d: Date): number {
  return Math.floor(new Date(d).getTime() / 60_000)
}
