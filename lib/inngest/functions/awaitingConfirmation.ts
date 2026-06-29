import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { pusherServer } from "@/lib/pusher/server"

// After the cleaner marks a job done, wait a few days for the client to confirm. If they don't (and it
// wasn't disputed/cancelled or already released), flag it to admin to review for manual release.
// Payment is NEVER auto-released — admin-only policy — so this only nudges, it doesn't capture.
export const onAwaitingConfirmation = inngest.createFunction(
  { id: "booking-awaiting-confirmation", retries: 2, triggers: [{ event: "booking/awaiting-confirmation" }] },
  async ({ event, step }: { event: { data: { bookingId: string } }; step: any }) => {
    const { bookingId } = event.data

    await step.sleep("wait-3-days", "3 days")

    await step.run("nudge-admin-if-unconfirmed", async () => {
      const [b] = await db
        .select({ status: bookings.status, clientConfirmedAt: bookings.clientConfirmedAt, bookingNumber: bookings.bookingNumber })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      // Still waiting on the client + not disputed/cancelled/released → tell admin to review.
      if (!b || b.status !== "pending_capture" || b.clientConfirmedAt) return { skipped: true }

      try { await pusherServer.trigger("private-admin", "booking-awaiting-release", { bookingId }) } catch { /* non-fatal */ }

      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        await resend.emails.send({
          from: FROM,
          to: adminEmail,
          subject: `Booking ${b.bookingNumber} awaiting client confirmation`,
          html: `<p>Booking <strong>${b.bookingNumber}</strong> was marked done by the cleaner 3 days ago, but the client hasn't confirmed completion.</p><p>If the cleaner has proof the job was done, release the payment from the admin bookings page.</p>`,
        })
      }
      return { nudged: true }
    })

    return { bookingId }
  }
)
