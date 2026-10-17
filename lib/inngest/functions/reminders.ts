import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, users, providers, notifications } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { reminderTomorrowEmail } from "@/lib/resend/transactionalEmails"
import { startingSoonEmail, deadlineSoonEmail } from "@/lib/resend/activityEmails"
import { getDeadlineWarningHours, getReminderHoursBefore } from "@/lib/platform/settings"
import { SITE_URL } from "@/lib/seo/site"

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
        .select({
          scheduledAt: bookings.scheduledAt,
          scheduledEndAt: bookings.scheduledEndAt,
          bookingNumber: bookings.bookingNumber,
          serviceAddress: bookings.serviceAddress,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      return b ?? null
    })
    if (!booking) return { skipped: true, reason: "booking_not_found" }

    const scheduledTime = new Date(booking.scheduledAt)
    const scheduledMs = scheduledTime.getTime()
    if (scheduledTime <= new Date()) return { skipped: true, reason: "already_passed" }
    const bookingNumber = booking.bookingNumber
    // Null for older bookings that predate the end-time column — those simply get no finish-by
    // warning rather than a guessed one.
    const endMs = booking.scheduledEndAt ? new Date(booking.scheduledEndAt).getTime() : null

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
    // Admin-set, not hardcoded — read once here so the sleep below and the "in N hours" wording in
    // the email are the same number. Read at scheduling time, so a change applies to new bookings.
    const reminderHours = await step.run("fetch-reminder-hours", getReminderHoursBefore)
    const startingSoonAt = new Date(scheduledMs - reminderHours * 60 * 60 * 1000)

    if (dayBefore > new Date()) {
      await step.sleepUntil("until-day-before", dayBefore)
      await step.run("remind-day-before", async () => {
        if (!(await stillValid())) return
        const [c] = await db.select({ email: users.email, firstName: users.firstName, locale: users.locale, emailReminders: users.emailReminders }).from(users).where(eq(users.id, customerId))
        // Client: email (only if they haven't opted out) + in-app (always)
        if (c?.email && c.emailReminders) {
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
            userId: provider.userId, bookingId, tag: "day_before", variant: "booking_reminder_provider",
            datetime: fmtTz("en-GB"), link: `/provider/bookings`,
            title: "Booking tomorrow", body: `You have a cleaning job scheduled for tomorrow at ${fmtTz("en-GB")}.`,
          })
        }
      })
    }

    if (startingSoonAt > new Date()) {
      await step.sleepUntil("until-starting-soon", startingSoonAt)
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
            userId: provider.userId, bookingId, tag: "2h", variant: "booking_reminder_provider",
            datetime: fmtTz("en-GB"), link: `/provider/bookings`,
            title: "Booking starting soon", body: `Reminder: your cleaning job starts at ${fmtTz("en-GB")}.`,
          })
        }

        // ...and by email, to BOTH sides. This close-in reminder was in-app only, so the person
        // about to travel to a stranger's home got no push at all.
        const hrs = Math.max(1, Math.round((scheduledMs - Date.now()) / 3_600_000))
        const [cu] = await db.select({ email: users.email, locale: users.locale, emailReminders: users.emailReminders }).from(users).where(eq(users.id, customerId))
        if (cu?.email && cu.emailReminders) {
          const { subject, html } = startingSoonEmail(cu.locale, {
            number: bookingNumber, address: addr, scheduled: fmtTz(cu.locale ?? "en-GB"), hours: hrs,
            url: `${SITE_URL}/bookings/${bookingId}`,
          })
          await resend.emails.send({ from: FROM, to: cu.email, subject, html })
        }
        if (provider) {
          const [pu] = await db.select({ email: users.email, locale: users.locale, emailReminders: users.emailReminders }).from(users).where(eq(users.id, provider.userId))
          if (pu?.email && pu.emailReminders) {
            const { subject, html } = startingSoonEmail(pu.locale, {
              number: bookingNumber, address: addr, scheduled: fmtTz(pu.locale ?? "en-GB"), hours: hrs,
              url: `${SITE_URL}/provider/bookings`,
            })
            await resend.emails.send({ from: FROM, to: pu.email, subject, html })
          }
        }
      })
    }

    // The cleaner's finish-by warning. New: nothing watched the END of a job before, yet a cleaner
    // who forgets to mark it complete simply doesn't get paid, and starts accruing a late penalty.
    if (endMs && provider) {
      const warnHours = await getDeadlineWarningHours()
      const warnAt = new Date(endMs - warnHours * 60 * 60 * 1000)
      if (warnAt > new Date()) {
        await step.sleepUntil("until-deadline-warning", warnAt)
        await step.run("warn-deadline", async () => {
          // Only worth sending while the job is still open — once it's marked done, it's noise.
          const [b] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId))
          if (!b || !["confirmed", "in_progress"].includes(b.status)) return
          const endStr = new Date(endMs).toLocaleString("en-GB", { timeZone: tz })
          await insertReminder({
            userId: provider.userId, bookingId, tag: "deadline", variant: "booking_reminder_provider",
            datetime: endStr, link: `/provider/bookings`,
            title: "Job due to finish soon", body: `This cleaning is due to be finished by ${endStr}. Mark it complete so you can be paid.`,
          })
          const [pu] = await db.select({ email: users.email, locale: users.locale, emailReminders: users.emailReminders }).from(users).where(eq(users.id, provider.userId))
          if (pu?.email && pu.emailReminders) {
            const { subject, html } = deadlineSoonEmail(pu.locale, {
              number: bookingNumber, address: addr,
              deadline: new Date(endMs).toLocaleString(pu.locale ?? "en-GB", { timeZone: tz }),
              hours: warnHours,
              url: `${SITE_URL}/provider/bookings`,
            })
            await resend.emails.send({ from: FROM, to: pu.email, subject, html })
          }
        })
      }
    }

    return { bookingId, reminded: true }
  }
)
