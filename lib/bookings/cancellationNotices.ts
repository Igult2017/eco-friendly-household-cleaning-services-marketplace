import { db } from "@/lib/db"
import { notifications, providers, bookingCancellationEvents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { alertAdmins } from "@/lib/notifications/adminAlert"

type Role = "customer" | "provider"

export type NoticeInput = {
  bookingId: string
  userId: string
  callerRole: Role
  customerId: string
  providerId: string
  scheduledAt: Date | string
  statusBefore: string
  reason?: string | null
  reasonCategory: string
  /** What the person who cancelled is liable for (cents) — charged for a client, recorded for a cleaner. */
  cancellerLiability: number
  travelCompensation: number
  /** Money that genuinely went back to the client (cents) — 0 when no hold was ever held. */
  refundAmount: number
  /** The free-cancellation window in hours, for the wording of the fee notice. */
  tier1Hours: number
  hoursUntilJob: number
}

/**
 * Write the immutable audit row and tell everyone who needs to know. Never throws — a cancellation
 * that already succeeded must not be reported as failed because a notification could not be saved.
 */
export async function recordCancellationNotices(n: NoticeInput): Promise<void> {
  // Immutable audit trail — required for dispute resolution, never blocks the cancellation itself.
  try {
    await db.insert(bookingCancellationEvents).values({
      bookingId: n.bookingId,
      actorUserId: n.userId,
      actorRole: n.callerRole === "customer" ? "client" : "cleaner",
      action: "cancelled",
      scheduledAt: new Date(n.scheduledAt),
      statusBefore: n.statusBefore,
      cancellationFeeAmount: n.cancellerLiability,
      travelCompensationAmount: n.travelCompensation,
      refundAmount: n.refundAmount,
      reason: n.reason ?? null,
      reasonCategory: n.reasonCategory,
    })
  } catch (auditErr) {
    console.warn("[cancel] audit log insert failed:", auditErr)
  }

  const dt = new Date(n.scheduledAt).toLocaleString("en-GB")

  // A cleaner who cancels late owes a fee on the same ladder a client would. Nothing is taken
  // automatically: a cleaner has no card on file, and the platform never holds a payout batch to
  // deduct from (each job pays them directly through Stripe), so there is nothing to net it off
  // against. Tell them what they owe and flag it for an admin. Their reliability score already falls
  // on its own — computeReliability counts cleaner-cancelled jobs against them.
  if (n.callerRole === "provider" && n.cancellerLiability > 0) {
    const owed = (n.cancellerLiability / 100).toFixed(2)
    try {
      await db.insert(notifications).values({
        userId: n.userId,
        type: "booking_cancelled",
        title: "Late cancellation fee",
        body: `You cancelled a booking less than ${n.tier1Hours} hours before it was due, so a €${owed} late-cancellation fee applies. The client was refunded in full. If this was unavoidable, contact support and it can be waived.`,
        link: "/provider/bookings",
        metadata: { variant: "booking_cancelled_party", datetime: dt },
      })
      await alertAdmins(
        "A cleaner cancelled late — fee owed",
        `Booking ${n.bookingId} was cancelled by the cleaner ${Math.round(n.hoursUntilJob)}h before the appointment. Fee owed: €${owed} (reason given: ${n.reasonCategory}). The client was refunded in full. This is RECORDED, not collected — there is no automatic way to charge a cleaner.`,
        "/admin/bookings",
      )
    } catch (feeErr) {
      console.warn("[cancel] failed to notify cleaner of late-cancellation fee:", feeErr)
    }
  }

  // Notify the OTHER party — the canceller already knows. (The booking_cancelled base copy means
  // "Payment failed", so use the booking_cancelled_party variant for a proper localized message.)
  try {
    if (n.callerRole === "customer") {
      const [pv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, n.providerId))
      if (pv) {
        await db.insert(notifications).values({
          userId: pv.userId, type: "booking_cancelled", title: "Booking cancelled",
          body: `A booking scheduled for ${dt} was cancelled by the client.`,
          link: "/provider/bookings", metadata: { variant: "booking_cancelled_party", datetime: dt },
        })
      }
    } else if (n.reason) {
      // The cleaner turned the booking down with a stated reason — tell the client why, and that
      // their money was fully released (a cleaner-initiated cancel is always a 100% release).
      await db.insert(notifications).values({
        userId: n.customerId, type: "booking_cancelled", title: "Booking declined",
        body: `Your cleaner can't take the booking scheduled for ${dt}. Reason: ${n.reason}. Your payment hold was fully released.`,
        link: "/browse", metadata: { variant: "booking_rejected", datetime: dt, reason: n.reason },
      })
    } else {
      await db.insert(notifications).values({
        userId: n.customerId, type: "booking_cancelled", title: "Booking cancelled",
        body: `Your booking scheduled for ${dt} was cancelled.`,
        link: "/dashboard", metadata: { variant: "booking_cancelled_party", datetime: dt },
      })
    }
  } catch (notifErr) {
    console.warn("[cancel] failed to notify other party:", notifErr)
  }
}
