import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, payments } from "@/lib/db/schema"
import { and, eq, lte, isNotNull } from "drizzle-orm"

// Safety net for the money flow. The normal path captures payment within seconds of a cleaner
// marking a job complete (onBookingCompleted). If that Inngest send was ever dropped or the
// capture failed, the booking is stranded in `pending_capture` and the card authorization
// expires after ~7 days — cleaner never paid. This hourly sweep re-emits `booking/completed`
// for any booking stuck > 15 min. Capture is idempotent (idempotencyKey `capture-<pi>`), so
// re-emitting can never double-charge.
export const captureSweeper = inngest.createFunction(
  { id: "capture-sweeper", retries: 1, triggers: [{ cron: "0 * * * *" }] },
  async ({ step }: { step: any }) => {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000)

    const stuck = await step.run("find-stuck", async () => {
      return db
        .select({
          id: bookings.id,
          providerId: bookings.providerId,
          customerId: bookings.customerId,
          pi: payments.stripePaymentIntentId,
        })
        .from(bookings)
        .innerJoin(payments, eq(payments.bookingId, bookings.id))
        .where(and(
          eq(bookings.status, "pending_capture"),
          isNotNull(bookings.actualEndAt),
          lte(bookings.actualEndAt, cutoff),
        ))
        .limit(200)
    })

    const events = (stuck as { id: string; providerId: string; customerId: string; pi: string | null }[])
      .filter((b) => b.pi)
      .map((b) => ({
        name: "booking/completed" as const,
        data: { bookingId: b.id, paymentIntentId: b.pi as string, providerId: b.providerId, customerId: b.customerId },
      }))

    if (events.length > 0) await inngest.send(events)
    return { swept: events.length }
  }
)
