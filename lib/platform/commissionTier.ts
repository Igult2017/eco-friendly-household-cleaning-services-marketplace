import { db } from "@/lib/db"
import { bookings, recurringSchedules } from "@/lib/db/schema"
import { and, eq, inArray, count } from "drizzle-orm"
import { getCommissionPct, getRegularClientCommissionPct, getRegularClientAfterJobs } from "@/lib/platform/settings"

// Appointments that count as "this client and this cleaner have worked together before". A booking
// that was cancelled or refunded never delivered a service, so it does not move anyone up a tier.
const DELIVERED = ["pending_capture", "completed", "client_no_show"] as const

export type CommissionDecision = {
  pct: number
  /** Why this rate — carried into the booking's own record and useful when a payout is questioned. */
  reason: "one_off" | "regular_early" | "regular_established"
  priorJobs: number
}

/**
 * How much commission the platform keeps on ONE booking.
 *
 * Two different rates, because a client who comes back every week is worth far more to the platform
 * than a one-off and the cleaner should see that:
 *
 *   - a one-off client            → the standard rate (commission_pct)
 *   - a regular client, jobs 1-3  → the standard rate as well
 *   - a regular client, job 4 on  → the reduced rate (commission_regular_pct)
 *
 * "Regular" means this client and this cleaner have a repeating arrangement — either the booking was
 * made as a recurring one, or a recurring schedule already exists between the two of them. It is NOT
 * simply "they have booked before": a client who happens to rebook the same cleaner twice by chance
 * has not committed to anything.
 *
 * The count is per client-cleaner PAIR, not per schedule, so a client who books the same cleaner on
 * two weekdays (two schedule rows) still reaches the reduced rate after three jobs between them, not
 * six. Same basis the recurring discount already uses.
 *
 * Never throws: on any database trouble it falls back to the standard rate, which is the safe side —
 * a cleaner is never accidentally paid less than the tier they are owed... and a failed lookup can
 * never hand out the reduced rate to someone who has not earned it.
 */
export async function resolveCommissionPct(params: {
  customerId: string
  providerId: string
  /** True when this booking is itself recurring (a cadence was requested, or the robot created it). */
  isRecurring?: boolean
}): Promise<CommissionDecision> {
  const { customerId, providerId, isRecurring } = params
  const standard = await getCommissionPct()

  try {
    let regular = isRecurring === true
    if (!regular) {
      // Any schedule ever created between the two of them — a paused or cancelled one still means
      // the relationship was a repeating one, exactly as the recurring discount treats it.
      const [sched] = await db
        .select({ id: recurringSchedules.id })
        .from(recurringSchedules)
        .where(and(eq(recurringSchedules.customerId, customerId), eq(recurringSchedules.providerId, providerId)))
        .limit(1)
      regular = !!sched
    }
    if (!regular) return { pct: standard, reason: "one_off", priorJobs: 0 }

    const [row] = await db
      .select({ n: count() })
      .from(bookings)
      .where(and(
        eq(bookings.customerId, customerId),
        eq(bookings.providerId, providerId),
        inArray(bookings.status, [...DELIVERED]),
      ))
    const priorJobs = Number(row?.n ?? 0)

    const afterJobs = await getRegularClientAfterJobs()
    if (priorJobs < afterJobs) return { pct: standard, reason: "regular_early", priorJobs }

    const reduced = await getRegularClientCommissionPct()
    return { pct: reduced, reason: "regular_established", priorJobs }
  } catch (err) {
    console.warn("[commissionTier] could not resolve the tier — using the standard rate:", err)
    return { pct: standard, reason: "one_off", priorJobs: 0 }
  }
}
