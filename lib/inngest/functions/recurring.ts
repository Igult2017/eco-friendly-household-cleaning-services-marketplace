import { inngest } from "../client"
import { db } from "@/lib/db"
import { recurringSchedules, bookings, notifications, providerServices, providers, users, payments } from "@/lib/db/schema"
import { eq, and, lte, isNotNull } from "drizzle-orm"
import { redis } from "@/lib/redis/client"
import { calculateBookingAmounts, stripe } from "@/lib/stripe/client"
import { getCommissionPct } from "@/lib/platform/settings"

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
          .select({ stripeAccountId: providers.stripeAccountId, recurringDiscountPct: providers.recurringDiscountPct, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
          .from(providers)
          .where(eq(providers.id, schedule.providerId))

        // FIN-008: a provider suspended/unapproved after the schedule was set up must not keep
        // receiving recurring bookings or off-session charges. Skip this cycle and advance.
        if (!providerRow?.isApproved || providerRow.isSuspended) {
          const nextDate = addFrequencyInTZ(scheduledAt, schedule.frequency, schedule.timezone)
          await db.update(recurringSchedules)
            .set({ nextBookingAt: nextDate, updatedAt: new Date() })
            .where(eq(recurringSchedules.id, schedule.id))
          await db.insert(notifications).values({
            userId: schedule.customerId,
            type: "recurring_booking_created",
            title: "Recurring booking skipped",
            body: "Your recurring cleaner is temporarily unavailable, so this cycle was skipped. We'll try again next time.",
            link: `/dashboard`,
          })
          return
        }

        // Cleaner-set recurring loyalty discount: applied to every recurring booking.
        const baseSubtotal = service?.basePrice ?? 0
        const recurringDiscountCents = Math.round(baseSubtotal * (providerRow?.recurringDiscountPct ?? 0) / 100)
        const subtotal = Math.max(0, baseSubtotal - recurringDiscountCents)
        const commissionPct = await getCommissionPct()
        const amounts = calculateBookingAmounts(subtotal, commissionPct)
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
            platformFeePercent: commissionPct,
            subtotalAmount: amounts.subtotalCents,
            platformFeeAmount: amounts.platformFee,
            totalAmount: amounts.totalCharged,
            providerPayout: amounts.providerPayout,
            carbonOffsetAmount: 0,
            discountAmount: recurringDiscountCents,
            completionPhotoUrls: [],
          })
          .returning({ id: bookings.id })

        // Attempt off-session Stripe payment if a saved payment method is on file
        let paymentFailed = false
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
              }, { idempotencyKey: `recurring-pi-${newBooking.id}` })

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
              // FIN-006: an off-session charge can fail (declined/expired/insufficient funds).
              // Don't leave a phantom unpaid booking the cleaner might act on — cancel it and
              // tell the customer to update their card. The schedule still advances so a fixed
              // card is retried next cycle.
              console.error("[recurring-cron] Off-session payment failed:", (err as Error).message)
              paymentFailed = true
              await db.update(bookings)
                .set({ status: "cancelled", cancellationReason: "Recurring payment failed", cancelledAt: new Date() })
                .where(eq(bookings.id, newBooking.id))
            }
          }
        }

        const notifBody = scheduledAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
        await db.insert(notifications).values(
          paymentFailed
            ? {
                userId: schedule.customerId,
                type: "recurring_booking_created",
                title: "Recurring booking payment failed",
                body: `We couldn't charge your saved card for the booking on ${notifBody}. Please update your payment method to keep your recurring schedule active.`,
                link: `/dashboard`,
              }
            : {
                userId: schedule.customerId,
                type: "recurring_booking_created",
                title: "Recurring booking scheduled",
                body: `Your recurring booking has been scheduled for ${notifBody}.`,
                link: `/bookings/${newBooking.id}`,
              }
        )

        const nextDate = addFrequencyInTZ(scheduledAt, schedule.frequency, schedule.timezone)
        await db.update(recurringSchedules)
          .set({ nextBookingAt: nextDate, updatedAt: new Date() })
          .where(eq(recurringSchedules.id, schedule.id))

        if (!paymentFailed) created++
      })
    }

    return { processed: dueSchedules.length, created }
  }
)
