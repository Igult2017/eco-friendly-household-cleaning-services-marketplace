import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, providers, users, notifications } from "@/lib/db/schema"
import { eq, and, inArray, lt } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { overdueEmail } from "@/lib/resend/transactionalEmails"
import { pusherServer } from "@/lib/pusher/server"

const ACTIVE = ["payment_authorized", "confirmed", "in_progress"] as const
const DAY = 86_400_000
const HOUR = 3_600_000

// Every 6h: find jobs whose scheduled end has passed but the cleaner hasn't marked done. Flag them
// overdue, nudge the cleaner (in-app + email) ~daily, notify the client once, and escalate to admin at
// 2 days overdue. The actual 5%/day penalty is computed when the cleaner finally marks done (complete
// route) and applied at capture (completion.ts).
export const bookingOverdueSweep = inngest.createFunction(
  { id: "booking-overdue-sweep", retries: 1, triggers: [{ cron: "0 */6 * * *" }] },
  async ({ step }: { step: any }) => {
    const now = Date.now()

    const rows = await step.run("find-candidates", async () => {
      return db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          customerId: bookings.customerId,
          scheduledAt: bookings.scheduledAt,
          scheduledEndAt: bookings.scheduledEndAt,
          overdueSince: bookings.overdueSince,
          lastOverdueNudgeAt: bookings.lastOverdueNudgeAt,
          overdueEscalatedAt: bookings.overdueEscalatedAt,
          providerTimezone: providers.timezone,
          providerUserId: providers.userId,
          providerBusinessName: providers.businessName,
        })
        .from(bookings)
        .leftJoin(providers, eq(bookings.providerId, providers.id))
        .where(and(inArray(bookings.status, ACTIVE), lt(bookings.scheduledAt, new Date())))
        .limit(200)
    })

    let overdue = 0
    for (const b of rows) {
      const end = b.scheduledEndAt ? new Date(b.scheduledEndAt).getTime() : new Date(b.scheduledAt).getTime() + 2 * HOUR
      if (end >= now) continue // scheduled end hasn't passed yet
      overdue++

      await step.run(`overdue-${b.id}`, async () => {
        const tz = b.providerTimezone || "Europe/Berlin"
        const dt = new Date(b.scheduledAt).toLocaleString("en-GB", { timeZone: tz })
        const first = !b.overdueSince
        const needNudge = first || !b.lastOverdueNudgeAt || now - new Date(b.lastOverdueNudgeAt).getTime() >= 20 * HOUR

        if (first) {
          await db.update(bookings).set({ overdueSince: new Date(), lastOverdueNudgeAt: new Date() }).where(eq(bookings.id, b.id))
          // Notify the client once.
          await db.insert(notifications).values({
            userId: b.customerId, type: "booking_reminder",
            title: "Your cleaning is overdue", body: `Your cleaner hasn't completed the job scheduled for ${dt} yet.`,
            link: `/bookings/${b.id}`, metadata: { variant: "booking_overdue_client", datetime: dt },
          })
        }

        if (needNudge && b.providerUserId) {
          if (!first) await db.update(bookings).set({ lastOverdueNudgeAt: new Date() }).where(eq(bookings.id, b.id))
          await db.insert(notifications).values({
            userId: b.providerUserId, type: "booking_reminder",
            title: "Your job is overdue", body: `Your cleaning job on ${dt} is overdue. Please complete it — a 5%/day late fee applies.`,
            link: `/provider/bookings`, metadata: { variant: "booking_overdue_cleaner", datetime: dt },
          })
          const [pu] = await db.select({ email: users.email, locale: users.locale }).from(users).where(eq(users.id, b.providerUserId))
          if (pu?.email) {
            const { subject, html } = overdueEmail(pu.locale, { number: b.bookingNumber, date: dt })
            await resend.emails.send({ from: FROM, to: pu.email, subject, html })
          }
        }

        // Escalate to admin once, at 2+ days overdue (Part 3 reassignment will hook in here).
        const overdueSinceMs = first ? now : new Date(b.overdueSince!).getTime()
        if (!b.overdueEscalatedAt && now - overdueSinceMs >= 2 * DAY) {
          await db.update(bookings).set({ overdueEscalatedAt: new Date() }).where(eq(bookings.id, b.id))
          try { await pusherServer.trigger("private-admin", "booking-overdue", { bookingId: b.id }) } catch { /* non-fatal */ }
          const adminEmail = process.env.ADMIN_EMAIL
          if (adminEmail) {
            await resend.emails.send({
              from: FROM, to: adminEmail,
              subject: `Booking ${b.bookingNumber} is 2+ days overdue`,
              html: `<p>Booking <strong>${b.bookingNumber}</strong> (cleaner: ${b.providerBusinessName ?? "—"}) is more than 2 days overdue and still not completed. Consider reassigning it to another nearby cleaner.</p>`,
            })
          }
        }
      })
    }

    return { scanned: rows.length, overdue }
  }
)
