import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, users, providers, notifications } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { reminderTomorrowEmail } from "@/lib/resend/transactionalEmails"

const ACTIVE = ["payment_authorized", "confirmed", "in_progress", "pending_capture"]

// Insert a booking_reminder notification, idempotent per (booking, tag) so Inngest retries OR a
// duplicate booking/created|rescheduled event can't double-notify the same person for the same window.
async function insertReminder(opts: {
  userId: string
  bookingId: string
  tag: string
  title: string
  body: string
  link: string
  datetime?: string
  variant?: string
}) {
  const idempotencyKey = `${opts.bookingId}:booking_reminder:${opts.tag}`
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, opts.userId),
        eq(notifications.type, "booking_reminder"),
        sql`${notifications.metadata}->>'idempotencyKey' = ${idempotencyKey}`
      )
    )
  if (existing) return
  await db.insert(notifications).values({
    userId: opts.userId,
    type: "booking_reminder",
    title: opts.title,
    body: opts.body,
    link: opts.link,
    metadata: {
      idempotencyKey,
      ...(opts.datetime ? { datetime: opts.datetime } : {}),
      ...(opts.variant ? { variant: opts.variant } : {}),
    },
  })
}

export const bookingReminders = inngest.createFunction(
  { id: "booking-reminders", retries: 2, triggers: [{ event: "booking/created" }, { event: "booking/rescheduled" }] },
  async ({ event, step }: { event: { data: { bookingId: string; customerId: string; providerId: string } }; step: any }) => {
    const { bookingId, customerId, providerId } = event.data

    const booking = await step.run("fetch-booking", async () => {
      const [b] = await db
        .select({ scheduledAt: bookings.scheduledAt, serviceAddress: bookings.serviceAddress })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      return b ?? null
    })
    if (!booking) return { skipped: true, reason: "booking_not_found" }

    const scheduledTime = new Date(booking.scheduledAt)
    const scheduledMs = scheduledTime.getTime()
    if (scheduledTime <= new Date()) return { skipped: true, reason: "already_passed" }

    const addr =
      typeof booking.serviceAddress === "object" && booking.serviceAddress !== null
        ? ((booking.serviceAddress as Record<string, unknown>)["line1"] as string | undefined) ?? ""
        : ""

    const provider = await step.run("fetch-provider", async () => {
      const [p] = await db.select({ userId: providers.userId, timezone: providers.timezone }).from(providers).where(eq(providers.id, providerId))
      return p ?? null
    })
    const tz = provider?.timezone || "Europe/Berlin"
    const fmtTz = (locale: string) => scheduledTime.toLocaleString(locale, { timeZone: tz })

    // A reminder must only fire if the booking is still ACTIVE and still at the time this reminder was
    // scheduled for. A cancel/reschedule during the sleep makes this stale → skip. (Reschedule emits a
    // fresh booking/rescheduled that schedules new reminders at the new time.)
    const stillValid = async (): Promise<boolean> => {
      const [b] = await db.select({ status: bookings.status, scheduledAt: bookings.scheduledAt }).from(bookings).where(eq(bookings.id, bookingId))
      return !!b && ACTIVE.includes(b.status) && new Date(b.scheduledAt).getTime() === scheduledMs
    }

    const dayBefore = new Date(scheduledMs - 24 * 60 * 60 * 1000)
    const twoHoursBefore = new Date(scheduledMs - 2 * 60 * 60 * 1000)

    if (dayBefore > new Date()) {
      await step.sleepUntil("until-day-before", dayBefore)
      await step.run("remind-day-before", async () => {
        if (!(await stillValid())) return
        const [c] = await db.select({ email: users.email, firstName: users.firstName, locale: users.locale }).from(users).where(eq(users.id, customerId))
        // Client: email + in-app
        if (c?.email) {
          const { subject, html } = reminderTomorrowEmail(c.locale, { name: c.firstName, time: fmtTz(c.locale ?? "en-GB"), address: addr || undefined })
          await resend.emails.send({ from: FROM, to: c.email, subject, html })
        }
        await insertReminder({
          userId: customerId, bookingId, tag: "day_before_client", variant: "booking_reminder_client",
          datetime: fmtTz(c?.locale ?? "en-GB"), link: `/bookings/${bookingId}`,
          title: "Upcoming cleaning", body: `Reminder — your cleaning is scheduled for ${fmtTz("en-GB")}.`,
        })
        // Cleaner: in-app (localized via base booking_reminder copy)
        if (provider) {
          await insertReminder({
            userId: provider.userId, bookingId, tag: "day_before",
            datetime: fmtTz("en-GB"), link: `/bookings/${bookingId}`,
            title: "Booking tomorrow", body: `You have a cleaning job scheduled for tomorrow at ${fmtTz("en-GB")}.`,
          })
        }
      })
    }

    if (twoHoursBefore > new Date()) {
      await step.sleepUntil("until-2h-before", twoHoursBefore)
      await step.run("remind-2h", async () => {
        if (!(await stillValid())) return
        const [c] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, customerId))
        // Client same-day in-app
        await insertReminder({
          userId: customerId, bookingId, tag: "2h_client", variant: "booking_reminder_client",
          datetime: fmtTz(c?.locale ?? "en-GB"), link: `/bookings/${bookingId}`,
          title: "Cleaning soon", body: `Your cleaning is starting soon — ${fmtTz("en-GB")}.`,
        })
        // Cleaner same-day in-app (English fallback copy; no localized 2h variant)
        if (provider) {
          await insertReminder({
            userId: provider.userId, bookingId, tag: "2h", link: `/bookings/${bookingId}`,
            title: "Booking in 2 hours", body: `Reminder: your cleaning job starts at ${fmtTz("en-GB")}.`,
          })
        }
      })
    }

    return { bookingId, reminded: true }
  }
)
