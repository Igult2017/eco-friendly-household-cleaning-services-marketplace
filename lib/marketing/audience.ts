import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { and, eq, gte, lte, isNull, sql, type SQL } from "drizzle-orm"
import type { AudienceFilter, RecipientProfile } from "./types"

export interface AudienceUser extends RecipientProfile {
  id: string
  email: string
  firstName: string | null
}

const MAX_RECIPIENTS = 5000

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

// Shared WHERE builder. `forMarketing` forces marketing consent (welcome/transactional pass false).
function buildConditions(filter: AudienceFilter, forMarketing: boolean): SQL[] {
  const conds: SQL[] = [eq(users.isActive, true), isNull(users.deletedAt)]
  if (filter.role && filter.role !== "all") conds.push(eq(users.role, filter.role))
  if (forMarketing || filter.onlyConsented) conds.push(eq(users.marketingConsent, true))
  if (filter.signedUpWithinDays) conds.push(gte(users.createdAt, daysAgo(filter.signedUpWithinDays)))
  if (filter.signedUpMoreThanDays) conds.push(lte(users.createdAt, daysAgo(filter.signedUpMoreThanDays)))
  if (filter.hasBooked) conds.push(sql`EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = ${users.id})`)
  if (filter.noBookings) conds.push(sql`NOT EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = ${users.id})`)
  return conds
}

// Resolve a segment filter to a concrete recipient list. Active, non-deleted users only.
export async function resolveAudience(filter: AudienceFilter, forMarketing = true): Promise<AudienceUser[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      role: users.role,
      createdAt: users.createdAt,
      bookingCount: sql<number>`(SELECT COUNT(*)::int FROM bookings b WHERE b.customer_id = ${users.id})`,
    })
    .from(users)
    .where(and(...buildConditions(filter, forMarketing)))
    .limit(Math.min(filter.limit ?? MAX_RECIPIENTS, MAX_RECIPIENTS))

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    role: r.role,
    bookingCount: Number(r.bookingCount ?? 0),
    signedUpDaysAgo: Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86_400_000),
  }))
}

// Cheap recipient count for the admin "Preview audience" button — a single COUNT, no row fetch.
export async function countAudience(filter: AudienceFilter, forMarketing = true): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(users)
    .where(and(...buildConditions(filter, forMarketing)))
  return row?.c ?? 0
}
