import { inngest } from "../client"
import { db } from "@/lib/db"
import { recurringSchedules, bookings, notifications, providerServices } from "@/lib/db/schema"
import { eq, and, lte, isNotNull } from "drizzle-orm"
import { redis } from "@/lib/redis/client"
import { calculateBookingAmounts, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client"

async function generateBookingNumber(): Promise<string> {
  const seq = await redis.incr("booking:seq")
  return `BK-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`
}

function addFrequency(date: Date, frequency: "weekly" | "biweekly" | "monthly"): Date {
  const next = new Date(date)
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7)
  } else if (frequency === "biweekly") {
    next.setDate(next.getDate() + 14)
  } else {
    next.setMonth(next.getMonth() + 1)
  }
  return next
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

    if (!dueSchedules || dueSchedules.length === 0) {
      return { processed: 0 }
    }

    let created = 0

    for (const schedule of dueSchedules as typeof recurringSchedules.$inferSelect[]) {
      await step.run(`create-booking-${schedule.id}`, async () => {
        const scheduledAt = schedule.nextBookingAt!

        // Check for existing booking on this schedule date to prevent double-create
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
          // Already created — just advance nextBookingAt
          const nextDate = addFrequency(scheduledAt, schedule.frequency)
          await db
            .update(recurringSchedules)
            .set({ nextBookingAt: nextDate, updatedAt: new Date() })
            .where(eq(recurringSchedules.id, schedule.id))
          return
        }

        const [service] = await db
          .select({ basePrice: providerServices.basePrice })
          .from(providerServices)
          .where(eq(providerServices.id, schedule.serviceId))

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
              line1: string
              line2?: string
              city: string
              state?: string
              postalCode: string
              country: string
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

        await db.insert(notifications).values({
          userId: schedule.customerId,
          type: "booking_confirmed",
          title: "Recurring booking created",
          body: `Your recurring booking has been scheduled for ${scheduledAt.toLocaleString("en-GB")}.`,
          link: `/bookings/${newBooking.id}`,
        })

        const nextDate = addFrequency(scheduledAt, schedule.frequency)
        await db
          .update(recurringSchedules)
          .set({ nextBookingAt: nextDate, updatedAt: new Date() })
          .where(eq(recurringSchedules.id, schedule.id))

        created++
      })
    }

    return { processed: dueSchedules.length, created }
  }
)
