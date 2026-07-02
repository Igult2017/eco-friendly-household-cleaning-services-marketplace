import { db } from "@/lib/db"
import { providerAvailability, providerBlackoutDates, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { zonedDayAndTime } from "@/lib/utils/tz"

/**
 * Is a provider available to start a job at `start` (a UTC instant)?
 * Evaluated in the provider's OWN timezone (the platform spans EU + US).
 *
 * - If the provider has configured weekly availability, the requested day-of-week + time must fall
 *   inside an active slot. If they've configured NO availability at all, we don't block (treat as
 *   "available" — they simply haven't restricted their hours yet).
 * - A blackout date ALWAYS blocks, regardless of weekly availability.
 *
 * Used by both booking creation and reschedule so the rules can't diverge or be bypassed.
 */
export async function checkProviderAvailable(
  providerId: string,
  start: Date,
): Promise<{ ok: boolean; reason?: string }> {
  const [prov] = await db.select({ timezone: providers.timezone }).from(providers).where(eq(providers.id, providerId))
  const tz = prov?.timezone || "Europe/Berlin"
  const { dayOfWeek, hhmm } = zonedDayAndTime(start, tz)

  const slots = await db
    .select({ dayOfWeek: providerAvailability.dayOfWeek, startTime: providerAvailability.startTime, endTime: providerAvailability.endTime })
    .from(providerAvailability)
    .where(and(eq(providerAvailability.providerId, providerId), eq(providerAvailability.isActive, true)))

  if (slots.length > 0) {
    const daySlot = slots.find((s) => s.dayOfWeek === dayOfWeek)
    if (!daySlot) return { ok: false, reason: "The cleaner is not available on that day." }
    // Postgres time columns read back as "HH:MM:SS" while hhmm is "HH:MM" — compare like-for-like or
    // the string comparison rejects the exact opening hour ("09:00" < "09:00:00" is true).
    const opens = daySlot.startTime.slice(0, 5)
    const closes = daySlot.endTime.slice(0, 5)
    if (hhmm < opens || hhmm >= closes) {
      return { ok: false, reason: "That time is outside the cleaner's working hours." }
    }
  }

  // Blackout date — compare on the provider's local calendar day (YYYY-MM-DD).
  const localYmd = start.toLocaleDateString("en-CA", { timeZone: tz })
  const [blk] = await db
    .select({ id: providerBlackoutDates.id })
    .from(providerBlackoutDates)
    .where(and(eq(providerBlackoutDates.providerId, providerId), eq(providerBlackoutDates.date, localYmd)))
  if (blk) return { ok: false, reason: "The cleaner is unavailable on that date." }

  return { ok: true }
}
