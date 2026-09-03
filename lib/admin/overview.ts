import { db } from "@/lib/db"
import { bookings, payments, users, emailCampaigns, emailSends } from "@/lib/db/schema"
import { and, gte, lt, eq, sql } from "drizzle-orm"

export type DayPoint = { date: string; visitors: number; signups: number; bookings: number; revenue: number }
export type CampaignMarker = { date: string; name: string; recipients: number }
export type Delta = { value: number; prev: number }

// One number and what it was over the previous, equally-long period — a figure with nothing to
// compare it to can't tell you whether anything is working.
function delta(value: number, prev: number): Delta {
  return { value, prev }
}

export function pctChange(d: Delta): number | null {
  if (d.prev === 0) return d.value === 0 ? 0 : null // null = "no baseline", not "0% change"
  return Math.round(((d.value - d.prev) / d.prev) * 100)
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Everything the consolidated overview needs, for a window of `days` and the equally-long window
 * before it (so every figure can show a direction of travel).
 *
 * Revenue deliberately reuses /admin/dashboard's definition — captured payments only — so the two
 * pages can never quote different revenue for the same business.
 */
export async function getOverviewData(days: number) {
  const now = new Date()
  const start = new Date(now.getTime() - days * 86_400_000)
  const prevStart = new Date(start.getTime() - days * 86_400_000)

  const [signupRows, bookingRows, revenueRows, prevTotals, funnelRow, campaignRows, emailRow] = await Promise.all([
    db
      .select({ day: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`, n: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(gte(users.createdAt, start))
      .groupBy(sql`1`),

    db
      .select({ day: sql<string>`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`, n: sql<number>`cast(count(*) as int)` })
      .from(bookings)
      .where(gte(bookings.createdAt, start))
      .groupBy(sql`1`),

    db
      .select({
        day: sql<string>`to_char(coalesce(${payments.capturedAt}, ${payments.createdAt}), 'YYYY-MM-DD')`,
        cents: sql<number>`cast(coalesce(sum(${payments.capturedAmount}), 0) as int)`,
      })
      .from(payments)
      .where(and(eq(payments.status, "captured"), gte(sql`coalesce(${payments.capturedAt}, ${payments.createdAt})`, start)))
      .groupBy(sql`1`),

    // The previous window, as single totals — only needed for the up/down arrows.
    Promise.all([
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(users).where(and(gte(users.createdAt, prevStart), lt(users.createdAt, start))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(bookings).where(and(gte(bookings.createdAt, prevStart), lt(bookings.createdAt, start))),
      db.select({ cents: sql<number>`cast(coalesce(sum(${payments.capturedAmount}), 0) as int)` }).from(payments)
        .where(and(eq(payments.status, "captured"),
          gte(sql`coalesce(${payments.capturedAt}, ${payments.createdAt})`, prevStart),
          lt(sql`coalesce(${payments.capturedAt}, ${payments.createdAt})`, start))),
    ]),

    // Lifetime funnel below the visitor stage: how many people ever booked, and how many came back.
    db
      .select({
        booked: sql<number>`cast(count(distinct ${bookings.customerId}) as int)`,
        repeat: sql<number>`cast(count(distinct case when x.c > 1 then ${bookings.customerId} end) as int)`,
      })
      .from(bookings)
      .innerJoin(
        sql`(select customer_id as cid, count(*) as c from bookings group by 1) x`,
        sql`x.cid = ${bookings.customerId}`,
      ),

    // Campaigns that actually went out inside the window — the markers on the timeline.
    db
      .select({ sentAt: emailCampaigns.sentAt, name: emailCampaigns.name, recipients: emailCampaigns.sentCount })
      .from(emailCampaigns)
      .where(and(sql`${emailCampaigns.sentAt} is not null`, gte(emailCampaigns.sentAt, start)))
      .orderBy(emailCampaigns.sentAt),

    db
      .select({
        sent: sql<number>`cast(count(*) filter (where ${emailSends.status} in ('sent','delivered','opened','clicked')) as int)`,
        opened: sql<number>`cast(count(*) filter (where ${emailSends.status} in ('opened','clicked')) as int)`,
        clicked: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'clicked') as int)`,
        bad: sql<number>`cast(count(*) filter (where ${emailSends.status} in ('bounced','complained')) as int)`,
      })
      .from(emailSends)
      .where(gte(emailSends.createdAt, start)),
  ])

  const [prevSignups, prevBookings, prevRevenue] = prevTotals

  const signupsBy = new Map(signupRows.map((r) => [r.day, Number(r.n)]))
  const bookingsBy = new Map(bookingRows.map((r) => [r.day, Number(r.n)]))
  const revenueBy = new Map(revenueRows.map((r) => [r.day, Number(r.cents)]))

  // Every day in the window gets a row, including the empty ones — gaps in a chart read as missing
  // data rather than as a quiet day.
  const series: DayPoint[] = []
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(start.getTime() + i * 86_400_000))
    series.push({
      date: key,
      visitors: 0, // filled from Umami by the caller; the DB knows nothing about traffic
      signups: signupsBy.get(key) ?? 0,
      bookings: bookingsBy.get(key) ?? 0,
      revenue: revenueBy.get(key) ?? 0,
    })
  }

  const totals = {
    signups: delta(series.reduce((a, d) => a + d.signups, 0), Number(prevSignups[0]?.n ?? 0)),
    bookings: delta(series.reduce((a, d) => a + d.bookings, 0), Number(prevBookings[0]?.n ?? 0)),
    revenue: delta(series.reduce((a, d) => a + d.revenue, 0), Number(prevRevenue[0]?.cents ?? 0)),
  }

  const markers: CampaignMarker[] = campaignRows
    .filter((c) => c.sentAt)
    .map((c) => ({ date: dayKey(new Date(c.sentAt as Date)), name: c.name, recipients: Number(c.recipients ?? 0) }))

  return {
    start,
    series,
    totals,
    markers,
    funnel: { booked: Number(funnelRow[0]?.booked ?? 0), repeat: Number(funnelRow[0]?.repeat ?? 0) },
    email: {
      sent: Number(emailRow[0]?.sent ?? 0),
      opened: Number(emailRow[0]?.opened ?? 0),
      clicked: Number(emailRow[0]?.clicked ?? 0),
      bad: Number(emailRow[0]?.bad ?? 0),
    },
  }
}
