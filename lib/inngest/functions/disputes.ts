import { inngest } from "../client"
import { db } from "@/lib/db"
import { disputes, bookings, users, notifications, providers } from "@/lib/db/schema"
import { resend, FROM } from "@/lib/resend/client"
import { pusherServer } from "@/lib/pusher/server"
import { eq } from "drizzle-orm"

export const onDisputeOpened = inngest.createFunction(
  { id: "dispute-opened", triggers: [{ event: "dispute/opened" }] },
  async ({ event, step }: { event: { data: { disputeId: string; bookingId: string; openedBy: string } }; step: any }) => {
    const { disputeId, bookingId, openedBy } = event.data

    const dispute = await step.run("fetch-dispute", async () => {
      const [d] = await db.select({ id: disputes.id, reason: disputes.reason, status: disputes.status }).from(disputes).where(eq(disputes.id, disputeId))
      return d
    })

    const booking = await step.run("fetch-booking", async () => {
      const [b] = await db.select({ id: bookings.id, customerId: bookings.customerId, providerId: bookings.providerId }).from(bookings).where(eq(bookings.id, bookingId))
      return b
    })

    if (!dispute || !booking) return { skipped: true }

    // Notify both parties
    await step.run("notify-parties", async () => {
      // Notify the OTHER party. booking.providerId is the providers PK, not a Clerk user id — so when
      // the customer opened the dispute we must resolve the provider's userId before inserting
      // (notifications.userId is a FK to users.id; using the PK throws 23503 and the step fails).
      let notifyUserId: string | null
      if (openedBy === booking.customerId) {
        const [prov] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, booking.providerId))
        notifyUserId = prov?.userId ?? null
      } else {
        notifyUserId = booking.customerId
      }
      if (!notifyUserId) return
      await db.insert(notifications).values({
        userId: notifyUserId,
        type: "dispute_opened",
        title: "A dispute has been opened",
        body: `Reason: ${dispute.reason}. Please respond within 72 hours.`,
        link: `/bookings/${bookingId}`,
      })
    })

    // Notify admin
    await step.run("notify-admin", async () => {
      try {
        await pusherServer.trigger("private-admin", "new-dispute", { disputeId, bookingId, reason: dispute.reason })
      } catch { /* non-critical */ }
    })

    // Wait 72 hours then auto-escalate if still open
    await step.sleep("wait-72h", "72 hours")

    await step.run("auto-escalate", async () => {
      const [current] = await db.select({ status: disputes.status }).from(disputes).where(eq(disputes.id, disputeId))
      if (!current || current.status !== "open") return { skipped: true }

      await db.update(disputes).set({ status: "escalated" }).where(eq(disputes.id, disputeId))

      // Notify admin of escalation
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        await resend.emails.send({
          from: FROM,
          to: adminEmail,
          subject: `[ESCALATED] Dispute ${disputeId} needs admin review`,
          html: `<p>Dispute ${disputeId} for booking ${bookingId} has been open for 72 hours and requires admin review.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/disputes">Open Admin Panel</a></p>`,
        })
      }

      try {
        await pusherServer.trigger("private-admin", "dispute-escalated", { disputeId, bookingId })
      } catch { /* non-critical */ }
    })

    return { disputeId, processed: true }
  }
)
