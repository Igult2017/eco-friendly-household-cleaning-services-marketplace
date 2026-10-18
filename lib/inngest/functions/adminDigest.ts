import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, users, providers, disputes } from "@/lib/db/schema"
import { and, eq, inArray, isNull, isNotNull, gte, lt, sql } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { adminDigestEmail, hasContent, type DigestCleaning, type DigestSignup, type DigestAttention } from "@/lib/resend/adminEmails"
import { SITE_URL } from "@/lib/seo/site"

// The admin's morning digest: what is happening today and tomorrow, who signed up, and what needs a
// decision. Its real purpose is the cleaner's PHONE NUMBER beside each job, so a cleaner who is
// about to miss one can be chased before it happens.
//
// Day boundaries are computed by Postgres in a named timezone, never by adding 24h in JS — a fixed
// 24-hour step silently produces the wrong day twice a year when the clocks change, which has
// already been proved once in this project's reporting code.
const BUSINESS_TZ = "Europe/Berlin"

// Work that has not happened yet. `pending_capture` is excluded: that job is already done.
// `as const` matters: inArray() checks the values against the status enum, and a plain string[]
// is rejected (same pattern as the no-show routes).
const UPCOMING = ["payment_authorized", "confirmed", "in_progress"] as const

/** Local midnight in BUSINESS_TZ, `days` from today, as a real instant. */
function localMidnight(days: number) {
  return sql`((date_trunc('day', now() AT TIME ZONE ${BUSINESS_TZ}) + ${sql.raw(`interval '${days} day'`)}) AT TIME ZONE ${BUSINESS_TZ})`
}

// 03:00 UTC, NOT 06:00. A cron runs in UTC, and the whole point of this email is to arrive before
// the first job of the day so a cleaner can still be chased — the bookings in production start at
// 06:00 local, so a 06:00 UTC send would have landed at 08:00 Berlin, two hours too late to be of
// any use. 03:00 UTC is 05:00 Berlin in summer and 04:00 in winter, so it is ahead of a 06:00 start
// in both halves of the year without relying on a timezone-aware cron, which this version of
// Inngest does not visibly document.
export const adminDailyDigest = inngest.createFunction(
  { id: "admin-daily-digest", retries: 2, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }: { step: any }) => {
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) return { skipped: true, reason: "ADMIN_EMAIL not set" }

    // ── Cleanings across the next two local days ────────────────────────────────────────────
    const rows = await step.run("fetch-cleanings", async () =>
      db
        .select({
          number: bookings.bookingNumber,
          scheduledAt: bookings.scheduledAt,
          address: bookings.serviceAddress,
          clientFirst: users.firstName,
          clientLast: users.lastName,
          cleanerName: providers.businessName,
          cleanerTz: providers.timezone,
          cleanerUserId: providers.userId,
        })
        .from(bookings)
        .leftJoin(users, eq(users.id, bookings.customerId))
        .leftJoin(providers, eq(providers.id, bookings.providerId))
        .where(
          and(
            inArray(bookings.status, UPCOMING),
            gte(bookings.scheduledAt, localMidnight(0)),
            lt(bookings.scheduledAt, localMidnight(2)),
          ),
        )
        .orderBy(bookings.scheduledAt),
    )

    // The cleaner's phone lives on their USER row — `providers` has no phone column. Fetched in one
    // extra query rather than a hand-written join, so Drizzle keeps the types honest.
    const phones = await step.run("fetch-cleaner-phones", async () => {
      const ids = [...new Set(rows.map((r: { cleanerUserId: string | null }) => r.cleanerUserId).filter(Boolean))] as string[]
      if (!ids.length) return {} as Record<string, string>
      const list = await db.select({ id: users.id, phone: users.phone }).from(users).where(inArray(users.id, ids))
      return Object.fromEntries(list.map((u) => [u.id, u.phone ?? ""])) as Record<string, string>
    })

    // Split into today/tomorrow by comparing calendar dates IN the business timezone, so the split
    // matches what a person in that timezone would call "today". en-CA formats as YYYY-MM-DD.
    const dayKey = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ })
    const todayKey = dayKey(new Date())

    const toCleaning = (r: (typeof rows)[number]): DigestCleaning => {
      const tz = r.cleanerTz || BUSINESS_TZ
      const addr =
        typeof r.address === "object" && r.address !== null
          ? ((r.address as Record<string, unknown>)["line1"] as string | undefined) ?? "—"
          : "—"
      return {
        number: r.number,
        // Rendered in the CLEANER's own timezone — that is the clock they turn up by.
        when: new Date(r.scheduledAt).toLocaleString("en-GB", { timeZone: tz, dateStyle: "short", timeStyle: "short" }),
        client: [r.clientFirst, r.clientLast].filter(Boolean).join(" ") || "—",
        cleaner: r.cleanerName ?? "—",
        cleanerPhone: (r.cleanerUserId && phones[r.cleanerUserId]) || "",
        address: addr,
      }
    }

    const today = rows.filter((r: (typeof rows)[number]) => dayKey(r.scheduledAt) === todayKey).map(toCleaning)
    const tomorrow = rows.filter((r: (typeof rows)[number]) => dayKey(r.scheduledAt) !== todayKey).map(toCleaning)

    // ── New signups in the last 24 hours ───────────────────────────────────────────────────
    const signups: DigestSignup[] = await step.run("fetch-signups", async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const list = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(gte(users.createdAt, since))
        .orderBy(users.createdAt)
      return list.map((u) => ({
        name: [u.firstName, u.lastName].filter(Boolean).join(" "),
        // Placeholder addresses belong to deleted or migrated accounts — say so rather than
        // presenting `…@dorixe.invalid` as though it were a real contact.
        email: u.email.endsWith(".invalid") ? "(placeholder account — no real address)" : u.email,
        role: u.role === "customer" ? "Client" : u.role === "provider" ? "Cleaner" : u.role,
        when: new Date(u.createdAt).toLocaleString("en-GB", { timeZone: BUSINESS_TZ, dateStyle: "short", timeStyle: "short" }),
      }))
    })

    // ── Things waiting on a human ──────────────────────────────────────────────────────────
    const attention: DigestAttention[] = await step.run("fetch-attention", async () => {
      const out: DigestAttention[] = []

      // Work finished, money still only on hold, client gone quiet. Nobody is paid until someone
      // presses Release payment — so this is the cleaner's wages sitting in limbo.
      const awaiting = await db
        .select({ number: bookings.bookingNumber, since: bookings.providerCompletedAt })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, "pending_capture"),
            isNotNull(bookings.providerCompletedAt),
            isNull(bookings.clientConfirmedAt),
          ),
        )
      for (const b of awaiting) {
        const days = b.since ? Math.floor((Date.now() - new Date(b.since).getTime()) / 86_400_000) : 0
        out.push({
          label: `Cleaner unpaid — ${b.number}`,
          detail: `Marked done ${days} day${days === 1 ? "" : "s"} ago; the client has not confirmed. Release the payment if the work was done.`,
          url: `${SITE_URL}/admin/bookings`,
        })
      }

      const open = await db.select({ id: disputes.id }).from(disputes).where(eq(disputes.status, "open"))
      if (open.length) {
        out.push({
          label: `${open.length} open dispute${open.length === 1 ? "" : "s"}`,
          detail: "Waiting on a decision.",
          url: `${SITE_URL}/admin/disputes`,
        })
      }

      const overdue = await db
        .select({ number: bookings.bookingNumber })
        .from(bookings)
        .where(and(isNotNull(bookings.overdueSince), inArray(bookings.status, UPCOMING)))
      for (const b of overdue) {
        out.push({
          label: `Overdue — ${b.number}`,
          detail: "Past its scheduled time and still not marked done.",
          url: `${SITE_URL}/admin/bookings`,
        })
      }

      return out
    })

    const payload = { today, tomorrow, signups, attention }
    // A daily email that always arrives and usually says nothing trains the reader to ignore it.
    if (!hasContent(payload)) return { skipped: true, reason: "nothing to report" }

    await step.run("send", async () => {
      const { subject, html } = adminDigestEmail({ ...payload, siteUrl: SITE_URL })
      await resend.emails.send({ from: FROM, to: adminEmail, subject, html })
    })

    return { today: today.length, tomorrow: tomorrow.length, signups: signups.length, attention: attention.length }
  },
)
