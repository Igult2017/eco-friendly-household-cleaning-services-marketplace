import { inngest } from "../client"
import { db } from "@/lib/db"
import { recurringSchedules, bookings, notifications, providerServices, providers, users, payments } from "@/lib/db/schema"
import { eq, and, lte, isNotNull, sql } from "drizzle-orm"
import { redis } from "@/lib/redis/client"
import { calculateDiscountedBookingAmounts, stripe } from "@/lib/stripe/client"

// The recurring discount only applies to a schedule's first N occurrences (the client's 2nd and
// 3rd cleaning overall, counting their first ad-hoc booking as #1) — after that it reverts to
// full price. Not admin-configurable: this is a fixed onboarding incentive, not an ongoing rate.
const RECURRING_DISCOUNT_OCCURRENCE_CAP = 2
import { getRecurringDiscountPct } from "@/lib/platform/settings"
import { priceForService, explainPrice, DEFAULT_DURATION_MINUTES } from "@/lib/bookings/price"
import { recordPaymentEvent } from "@/lib/payments/ledger"
import { alertAdmins } from "@/lib/notifications/adminAlert"
import { resolveCommissionPct } from "@/lib/platform/commissionTier"
import { getCurrencyForCountry } from "@/lib/utils/locale"
import { logError } from "@/lib/utils/logError"

async function generateBookingNumber(): Promise<string> {
  const seq = await redis.incr("booking:seq")
  return `BK-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`
}

/**
 * The next date in a recurring series.
 *
 * EXPORTED because the calendar projects future dates from it (lib/bookings/recurringProjection.ts).
 * Re-implementing this there would let the calendar drift from the bookings that actually get
 * created — the dates shown would be the ones nobody is ever charged for.
 */
export function addFrequencyInTZ(date: Date, frequency: "weekly" | "biweekly" | "monthly", timezone: string): Date {
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
        // Dates lose their type crossing an Inngest step boundary — step results are persisted as
        // JSON so they survive retries, and a Date comes back as a string. Everything below (the
        // duplicate check, the booking insert, addFrequencyInTZ, the notification text) treats this
        // as a real Date, so rebuild it here at the single source rather than at six call sites.
        const scheduledAt = new Date(schedule.nextBookingAt!)

        // A schedule stalled by that bug can be left pointing days into the past. Roll it forward to
        // the next future slot and stop there for this run: never create — and off-session charge
        // for — a cleaning whose time already passed, and don't charge early for one still days out.
        // The next daily run books it normally once it's inside the usual 24h window. In healthy
        // operation this never triggers: the cron picks a schedule up the day BEFORE it's due, so
        // the date is always still in the future when it's processed.
        if (scheduledAt.getTime() < Date.now()) {
          let next = scheduledAt
          // Guard the loop (≈10 years of weekly cycles) so a bad date can never spin forever.
          for (let i = 0; next.getTime() < Date.now() && i < 520; i++) {
            next = addFrequencyInTZ(next, schedule.frequency, schedule.timezone)
          }
          await db.update(recurringSchedules)
            .set({ nextBookingAt: next, updatedAt: new Date() })
            .where(eq(recurringSchedules.id, schedule.id))
          return
        }

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
          // priceUnit decides whether basePrice is an hourly rate or the whole-job price. Not
          // reading it is what made every repeat charge a single hour.
          .select({ basePrice: providerServices.basePrice, priceUnit: providerServices.priceUnit })
          .from(providerServices)
          .where(eq(providerServices.id, schedule.serviceId))

        const [providerRow] = await db
          .select({ stripeAccountId: providers.stripeAccountId, country: providers.country, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
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
            metadata: { variant: "recurring_skipped" },
          })
          return
        }

        // Admin-set recurring loyalty discount (platform-wide — was previously per-cleaner), capped at
        // the client's first 2 discounted cleanings TOTAL for this client-cleaner relationship — not
        // per schedule. A client can pick multiple recurring weekdays (e.g. weekly Tue + Thu), each
        // becoming its own schedule row; without summing across all of them, each day would
        // independently earn its own 2 discounted occurrences. Funded entirely from platform
        // commission — the cleaner is always paid as if the job were full price (see
        // calculateDiscountedBookingAmounts). Sums ALL schedules ever created for the pair (not just
        // active ones) — past discounted occurrences already happened; cancelling a schedule doesn't
        // un-spend that budget.
        // THE BUG THIS REPLACES: this used to be `service?.basePrice ?? 0`, which for a per-hour
        // service is ONE HOUR'S RATE used as the whole price. A client booking three hours a week
        // at €20/hr was charged €20 and the cleaner paid for one hour — every week, with nothing on
        // screen showing it (BK-2026-000010 to 000013, and 000015).
        //
        // priceForService is the SAME function one-off bookings use (lib/bookings/create.ts), so
        // the two cannot drift apart again.
        const durationSource = schedule.durationMinutes ? "schedule" as const : "fallback" as const
        const durationMinutes = schedule.durationMinutes ?? DEFAULT_DURATION_MINUTES
        const baseSubtotal = priceForService({
          basePrice: service?.basePrice ?? 0,
          priceUnit: service?.priceUnit ?? null,
          durationMinutes,
        })
        // Recurring by definition, so the tier is decided purely by how many jobs this client and
        // cleaner have already delivered together.
        const { pct: commissionPct } = await resolveCommissionPct({
          customerId: schedule.customerId, providerId: schedule.providerId, isRecurring: true,
        })
        const [{ totalOccurrences }] = await db
          .select({ totalOccurrences: sql<number>`COALESCE(SUM(occurrences_created), 0)` })
          .from(recurringSchedules)
          .where(and(eq(recurringSchedules.customerId, schedule.customerId), eq(recurringSchedules.providerId, schedule.providerId)))
        const discountEligible = Number(totalOccurrences) < RECURRING_DISCOUNT_OCCURRENCE_CAP
        const recurringDiscountPct = discountEligible ? await getRecurringDiscountPct() : 0
        const amounts = calculateDiscountedBookingAmounts(baseSubtotal, commissionPct, recurringDiscountPct)

        // The arithmetic, checked against itself BEFORE any money moves. `baseSubtotal` is what the
        // rate and hours say the job costs; `amounts.subtotalCents` is what the discount maths
        // carried forward. If those two ever disagree, something has gone wrong in between and a
        // charge would be a guess — so refuse it and tell a human, rather than take the wrong
        // amount from a real card. lib/bookings/create.ts has guarded one-off bookings this way
        // (line 150) since it was written; repeat bookings never had it.
        const workings = explainPrice({
          basePrice: service?.basePrice ?? 0,
          priceUnit: service?.priceUnit ?? null,
          durationMinutes,
          durationSource,
          chargedCents: amounts.subtotalCents,
          commissionCents: amounts.platformFee,
          commissionPct,
          payoutCents: amounts.providerPayout,
        })
        if (Math.abs(workings.mismatch) > 1 && recurringDiscountPct === 0) {
          await logError({
            message: "[recurring-cron] refusing to charge — the price does not match its own arithmetic",
            severity: "critical",
            context: { scheduleId: schedule.id, ...workings },
          })
          await alertAdmins(
            "A repeat cleaning was NOT charged — the price did not add up",
            `${workings.summary}. Nothing has been charged and the schedule has moved on, so no client was billed a wrong amount. Rate ${workings.rate} ${workings.unit}, ${workings.minutes} minutes (${workings.durationSource}).`,
            "/admin/payments/history",
          ).catch(() => {})
          const skipTo = addFrequencyInTZ(scheduledAt, schedule.frequency, schedule.timezone)
          await db.update(recurringSchedules)
            .set({ nextBookingAt: skipTo, updatedAt: new Date() })
            .where(eq(recurringSchedules.id, schedule.id))
          return
        }

        // Charge recurring bookings in the cleaner's own currency (US → USD, else EUR).
        const chargeCurrency = getCurrencyForCountry(providerRow.country).toLowerCase()
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
            // Recorded so the hours are visible on the booking, the calendar and every later
            // check. Its absence is exactly why the wrong charges were invisible: the rows showed
            // no duration at all, so nothing could compare the price against the hours.
            scheduledEndAt: new Date(scheduledAt.getTime() + durationMinutes * 60_000),
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
            discountAmount: amounts.discountCents,
            completionPhotoUrls: [],
          })
          .returning({ id: bookings.id })

        // The paper trail: rate, hours, what the sum says, what was actually charged, and the gap
        // between them. Written for every repeat cleaning whether or not the card succeeds, so the
        // question "why was I charged that?" has a recorded answer instead of needing someone to
        // re-derive it from a Stripe statement. Shown on /admin/payments/history.
        await recordPaymentEvent({
          bookingId: newBooking.id,
          userId: schedule.customerId,
          kind: "priced",
          amountCents: amounts.totalCharged,
          status: workings.mismatch === 0 ? "ok" : "mismatch",
          metadata: {
            summary: workings.summary,
            rate: String(workings.rate),
            unit: workings.unit,
            minutes: String(workings.minutes),
            durationSource: workings.durationSource,
            expected: String(workings.expected),
            charged: String(workings.charged),
            mismatch: String(workings.mismatch),
            commission: String(workings.commission),
            commissionPct: String(workings.commissionPct),
            payout: String(workings.payout),
            origin: "recurring",
          },
        }).catch(() => { /* the trail must never be the reason a booking fails */ })

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
                currency: chargeCurrency,
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
                currency: chargeCurrency,
              })
            } catch (err: unknown) {
              // An off-session charge can fail for more than one reason — a genuinely declined/
              // expired card, OR the card is fine but Stripe requires a fresh 3D-Secure check that
              // can't happen without the customer present. Cancelling outright used to treat both
              // the same way and lose the booking either way. Instead: move it to pending_payment
              // and point the customer at the real, already-built on-session recovery page — Stripe's
              // own PaymentElement there naturally handles a 3DS challenge when it's actually
              // needed, and a genuinely bad card just gets a clean re-entry. The schedule still
              // advances either way so a fixed card is retried next cycle regardless.
              console.error("[recurring-cron] Off-session payment failed:", (err as Error).message)
              void logError({
                message: "[recurring-cron] off-session payment failed", error: err,
                severity: "error", context: { bookingId: newBooking.id, scheduleId: schedule.id },
              })
              paymentFailed = true
              await db.update(bookings)
                .set({ status: "pending_payment" })
                .where(eq(bookings.id, newBooking.id))
            }
          }
        }

        const notifBody = scheduledAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: schedule.timezone })
        await db.insert(notifications).values(
          paymentFailed
            ? {
                userId: schedule.customerId,
                type: "recurring_booking_created",
                title: "Action needed: secure payment for your next cleaning",
                body: `We couldn't automatically charge your saved card for the booking on ${notifBody}. Add or confirm a payment method to keep this booking — your recurring schedule stays active either way.`,
                link: `/bookings/${newBooking.id}/pay`,
                metadata: { variant: "recurring_payment_failed", datetime: notifBody },
              }
            : {
                userId: schedule.customerId,
                type: "recurring_booking_created",
                title: "Recurring booking scheduled",
                body: `Your recurring booking has been scheduled for ${notifBody}.`,
                link: `/bookings/${newBooking.id}`,
                metadata: { datetime: notifBody },
              }
        )

        const nextDate = addFrequencyInTZ(scheduledAt, schedule.frequency, schedule.timezone)
        await db.update(recurringSchedules)
          // Counts against the discount cap regardless of payment outcome — the occurrence itself
          // happened/was attempted on schedule; only the "existing booking" and "provider skipped"
          // paths above (which never reach here) don't represent a real occurrence.
          .set({ nextBookingAt: nextDate, occurrencesCreated: sql`occurrences_created + 1`, updatedAt: new Date() })
          .where(eq(recurringSchedules.id, schedule.id))

        if (!paymentFailed) {
          // Emit the same event a normal booking fires so reminders get scheduled + the confirmation
          // is sent — recurring bookings previously got NO reminders at all.
          await inngest.send({ name: "booking/created", data: { bookingId: newBooking.id, customerId: schedule.customerId, providerId: schedule.providerId } })
          created++
        }
      })
    }

    return { processed: dueSchedules.length, created }
  }
)
