import { inngest } from "../client"
import { db } from "@/lib/db"
import { recurringSchedules, bookings, notifications, providerServices, providers, users, payments } from "@/lib/db/schema"
import { eq, and, lte, isNotNull } from "drizzle-orm"
import { redis } from "@/lib/redis/client"
import { calculateBookingAmounts, PLATFORM_FEE_PERCENT, stripe } from "@/lib/stripe/client"

async function generateBookingNumber(): Promise<string> {
  const seq = await redis.incr("booking:seq")
  return `BK-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`
}

function addFrequencyInTZ(date: Date, frequency: "weekly" | "biweekly" | "monthly", timezone: string): Date {
  if (frequency === "weekly")   return new Date(date.getTime() + 7 * 86_400_000)
  if (frequency === "biweekly") return new Date(date.getTime() + 14 * 86_400_000)

  // Monthly: add 1 month in the target timezone calendar to handle DST correctly
  const localStr = date.toLocaleString("sv-SE", { timeZone: timezone })
  const [datePart, timePart] = localStr.split(" ")
  const [y, mo, d] = datePart.split("-").map(Number)
  const [h, min] = timePart.split(":").map(Number)

  const nextYear  = mo === 12 ? y + 1 : y
  const nextMonth = mo === 12 ? 1 : mo + 1
  // Cap day to max days in the target month (e.g. Jan 31 → Feb 28)
  const maxDay = new Date(nextYear, nextMonth, 0).getDate()
  const nextDay = Math.min(d, maxDay)

  const nextDateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`
  const hStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
  const testUTC = new Date(`${nextDateStr}T${hStr}:00Z`)

  const inTZ = testUTC.toLocaleString("sv-SE", { timeZone: timezone })
  const [tzH, tzM] = inTZ.split(" ")[1].split(":").map(Number)
  const driftMs = ((h * 60 + min) - (tzH * 60 + tzM)) * 60_000

  return new Date(testUTC.getTime() + driftMs)
}

export const onRecurringScheduleCreated = inngest.createFunction(
  { id: "recurring-schedule-created", triggers: [{ event: "recurring/schedule.created" }] },
  async ({ event, step }: { event: { data: { scheduleId: string } }; step: any }) => {
    await step.run("create-first-reminder", async () => {
      console.log(`[recurring] schedule ${event.data.scheduleId} created — first booking will be created by cron`)
    })
    return { scheduleId: event.data.scheduleId, logged: true }
  }
)

export const recurringBookingCron = inngest.createFunction(
  { id: "recurring-booking-cron", retries: 2, triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }: { step: any }) => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const dueSchedules = await step.run("find-due-schedules", async () => {
      return db
        .select()
        .from(recurringSchedules)
        .where(
          and(
            eq(recurringSchedules.status, "active"),
            isNotNull(recurringSchedules.nextBookingAt),
            lte(recurringSchedules.nextBookingAt, cutoff)
          )
        )
    })

    if (!dueSchedules || dueSchedules.length === 0) return { processed: 0 }

    let created = 0

    for (const schedule of dueSchedules as typeof recurringSchedules.$inferSelect[]) {
      await step.run(`create-booking-${schedule.id}`, async () => {
        const scheduledAt = schedule.nextBookingAt!

        const existing = await db
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.customerId, schedule.customerId),
              eq(bookings.providerId, schedule.providerId),
              eq(bookings.scheduledAt, scheduledAt)
            )
          )
          .limit(1)

        if (existing.length > 0) {
          const nextDate = addFrequencyInTZ(scheduledAt, schedule.frequency, schedule.timezone)
          await db.update(recurringSchedules)
            .set({ nextBookingAt: nextDate, updatedAt: new Date() })
            .where(eq(recurringSchedules.id, schedule.id))
          return
        }

        const [service] = await db
          .select({ basePrice: providerServices.basePrice })
          .from(providerServices)
          .where(eq(providerServices.id, schedule.serviceId))

        const [providerRow] = await db
          .select({ stripeAccountId: providers.stripeAccountId })
          .from(providers)
          .where(eq(providers.id, schedule.providerId))

        const subtotal = service?.basePrice ?? 0
        const amounts = calculateBookingAmounts(subtotal)
        const bookingNumber = await generateBookingNumber()

        const [newBooking] = await db
          .insert(bookings)
          .values({
            bookingNumber,
            customerId: schedule.customerId,
            providerId: schedule.providerId,
            serviceId: schedule.serviceId,
            status: "pending_payment",
            scheduledAt,
            serviceAddress: schedule.serviceAddress as {
              line1: string; line2?: string; city: string;
              state?: string; postalCode: string; country: string
            },
            specialInstructions: schedule.specialInstructions ?? null,
            ecoOptionsSelected: (schedule.ecoOptions as string[]) ?? [],
            platformFeePercent: PLATFORM_FEE_PERCENT,
            subtotalAmount: amounts.subtotalCents,
            platformFeeAmount: amounts.platformFee,
            totalAmount: amounts.totalCharged,
            providerPayout: amounts.providerPayout,
            carbonOffsetAmount: 0,
            completionPhotoUrls: [],
          })
          .returning({ id: bookings.id })

        // Attempt off-session Stripe payment if a saved payment method is on file
        if (schedule.stripePaymentMethodId && providerRow?.stripeAccountId) {
          const [customerRow] = await db
            .select({ stripeCustomerId: users.stripeCustomerId })
            .from(users)
            .where(eq(users.id, schedule.customerId))

          if (customerRow?.stripeCustomerId) {
            try {
              const pi = await stripe.paymentIntents.create({
                amount: amounts.totalCharged,
                currency: "eur",
                customer: customerRow.stripeCustomerId,
                payment_method: schedule.stripePaymentMethodId,
                capture_method: "manual",
                application_fee_amount: amounts.platformFee,
                transfer_data: { destination: providerRow.stripeAccountId },
                confirm: true,
                off_session: true,
                metadata: { bookingId: newBooking.id, type: "recurring" },
              })

              const bookingStatus = pi.status === "requires_capture" ? "payment_authorized" : "pending_payment"
              await db.update(bookings)
                .set({ status: bookingStatus })
                .where(eq(bookings.id, newBooking.id))

              await db.insert(payments).values({
                bookingId: newBooking.id,
                customerId: schedule.customerId,
                stripePaymentIntentId: pi.id,
                stripeCustomerId: customerRow.stripeCustomerId,
                status: pi.status === "requires_capture" ? "authorized" : "pending",
                amount: amounts.totalCharged,
                currency: "eur",
              })
            } catch (err: unknown) {
              console.error("[recurring-cron] Off-session payment failed:", (err as Error).message)
            }
          }
        }

        const notifBody = scheduledAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
        await db.insert(notifications).values({
          userId: schedule.customerId,
          type: "recurring_booking_created",
          title: "Recurring booking scheduled",
          body: `Your recurring booking has been scheduled for ${notifBody}.`,
          link: `/bookings/${newBooking.id}`,
        })

        const nextDate = addFrequencyInTZ(scheduledAt, schedule.frequency, schedule.timezone)
        await db.update(recurringSchedules)
          .set({ nextBookingAt: nextDate, updatedAt: new Date() })
          .where(eq(recurringSchedules.id, schedule.id))

        created++
      })
    }

    return { processed: dueSchedules.length, created }
  }
)
