import { db } from "@/lib/db"
import { bookings, providers, notifications } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"

// Dual-confirm finish for a booking with NO payment on file: both parties confirmed, nothing to
// capture — mark completed, count the job, and tell both sides to settle payment directly.
export async function finalizeUnpaidBooking(bookingId: string) {
  const [updated] = await db
    .update(bookings)
    .set({ status: "completed" })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending_capture")))
    .returning({ providerId: bookings.providerId, customerId: bookings.customerId })
  if (!updated) return

  await db.update(providers).set({ totalJobsCompleted: sql`total_jobs_completed + 1` }).where(eq(providers.id, updated.providerId))

  const [pv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, updated.providerId))
  const note = {
    type: "booking_confirmed" as const,
    title: "Task completed",
    body: "Both of you confirmed the task is done. No payment method was on file — please settle payment directly as agreed.",
    metadata: { variant: "booking_completed_offline" },
  }
  await db.insert(notifications).values([
    { ...note, userId: updated.customerId, link: `/bookings/${bookingId}` },
    ...(pv ? [{ ...note, userId: pv.userId, link: "/provider/bookings" }] : []),
  ])
}
