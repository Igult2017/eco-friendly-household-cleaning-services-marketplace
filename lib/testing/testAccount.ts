import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { inArray, eq, and } from "drizzle-orm"

/**
 * Whether a job-board interaction is a TEST, and may therefore skip the self-dealing checks.
 *
 * WHY THIS EXISTS: the owner could not test his own platform without hiring real people. The job
 * board refuses a bid when it comes from the person who posted the job, from the same internet
 * connection, or from a cleaner outside the client's radius — three separate checks, all correct
 * for real users, all fatal to testing alone. The distance one is the worst of them: it refuses
 * outright when the cleaner has no coordinates at all, which is the case for anyone outside the
 * supported countries, so even two accounts on two machines would not have worked.
 *
 * ONE function answers "is this a test?" for all of those checks. Five separate conditions would be
 * five chances for one to be missed or to drift apart — exactly how repeat bookings ended up
 * pricing themselves differently from one-off bookings.
 *
 * WHAT IT DOES NOT TOUCH: payment, identity and payout rules all behave exactly as they do for a
 * real cleaner. Those are the things being tested; bypassing them would make the test worthless.
 */
export async function isTestParticipant(userIds: (string | null | undefined)[]): Promise<boolean> {
  const ids = userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
  if (ids.length === 0) return false

  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.isTestAccount, true)))
      .limit(1)
    // EITHER side being a test account is enough: the owner flags his own two accounts and can
    // then play both the client and the cleaner.
    return rows.length > 0
  } catch {
    // Fail CLOSED. If we cannot tell, treat it as a real interaction and keep every protection on
    // — an unreadable flag must never become a way around the anti-fraud checks.
    return false
  }
}

/** True when this one account is flagged. Used when stamping a booking as a test. */
export async function isTestAccount(userId: string | null | undefined): Promise<boolean> {
  return isTestParticipant([userId])
}
