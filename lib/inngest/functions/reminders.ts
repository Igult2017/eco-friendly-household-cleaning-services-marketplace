import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, users, providers, notifications } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { reminderTomorrowEmail } from "@/lib/resend/transactionalEmails"

export const bookingReminders = inngest.createFunction(
  { id: "booking-reminders", retries: 2, triggers: [{ event: "booking/created" }] },
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
    const now = new Date()

    if (scheduledTime <= now) return { skipped: true, reason: "already_passed" }

    const addr =
      typeof booking.serviceAddress === "object" && booking.serviceAddress !== null
        ? ((booking.serviceAddress as Record<string, unknown>)["line1"] as string | undefined) ?? ""
        : ""

    const dayBefore = new Date(scheduledTime.getTime() - 24 * 60 * 60 * 1000)
    const twoHoursBefore = new Date(scheduledTime.getTime() - 2 * 60 * 60 * 1000)

    if (dayBefore > new Date()) {
      await step.sleepUntil("until-day-before", dayBefore)

      await step.run("remind-customer-email", async () => {
        const [customer] = await db
          .select({ email: users.email, firstName: users.firstName, locale: users.locale })
          .from(users)
          .where(eq(users.id, customerId))
        if (!customer?.email) return
        const { subject, html } = reminderTomorrowEmail(customer.locale, {
          name: customer.firstName,
          time: scheduledTime.toLocaleString(customer.locale ?? "en-GB"),
          address: addr || undefined,
        })
        await resend.emails.send({ from: FROM, to: customer.email, subject, html })
      })

      await step.run("remind-provider-day-before", async () => {
        const [p] = await db
          .select({ userId: providers.userId })
          .from(providers)
          .where(eq(providers.id, providerId))
        if (!p) return
        const idempotencyKey = `${bookingId}:booking_reminder:day_before`
        const [existing] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, p.userId),
              eq(notifications.type, "booking_reminder"),
              sql`${notifications.metadata}->>'idempotencyKey' = ${idempotencyKey}`
            )
          )
        if (existing) return
        await db.insert(notifications).values({
          userId: p.userId,
          type: "booking_reminder",
          title: "Booking tomorrow",
          body: `You have a cleaning job scheduled for tomorrow at ${scheduledTime.toLocaleString("en-GB")}.`,
          link: `/bookings/${bookingId}`,
          metadata: { idempotencyKey },
        })
      })
    }

    if (twoHoursBefore > new Date()) {
      await step.sleepUntil("until-2h-before", twoHoursBefore)

      await step.run("remind-provider-2h", async () => {
        const [p] = await db
          .select({ userId: providers.userId })
          .from(providers)
          .where(eq(providers.id, providerId))
        if (!p) return
        const idempotencyKey = `${bookingId}:booking_reminder:2h_before`
        const [existing] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, p.userId),
              eq(notifications.type, "booking_reminder"),
              sql`${notifications.metadata}->>'idempotencyKey' = ${idempotencyKey}`
            )
          )
        if (existing) return
        await db.insert(notifications).values({
          userId: p.userId,
          type: "booking_reminder",
          title: "Booking in 2 hours",
          body: `Reminder: your cleaning job starts at ${scheduledTime.toLocaleString("en-GB")}.`,
          link: `/bookings/${bookingId}`,
          metadata: { idempotencyKey },
        })
      })
    }

    return { bookingId, reminded: true }
  }
)
