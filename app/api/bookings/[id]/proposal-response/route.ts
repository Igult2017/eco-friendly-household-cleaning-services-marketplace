import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, notifications } from "@/lib/db/schema"
import { and, eq, inArray, ne, lte, gte } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { inngest } from "@/lib/inngest/client"
import { checkProviderAvailable } from "@/lib/bookings/availability"
import { logError } from "@/lib/utils/logError"

// Whichever party did NOT create the pending proposal accepts or declines it. Accepting a new
// hourly rate re-authorizes the card OFF-SESSION for the new amount (new hold first, then release
// the old one) — the card was saved at booking via setup_future_usage; a rate change can only ever
// have been proposed by the cleaner (see propose/route.ts), so the accepting party here is always
// the client whenever hourlyCents is involved. Accepting a new time re-runs the same
// availability/conflict/cutoff checks the old standalone reschedule endpoint used to do on its own
// (that endpoint is retired — this is now the only place a booking's time actually moves).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id: bookingId } = await params
    const { action } = (await req.json().catch(() => ({}))) as { action?: string }
    if (action !== "accept" && action !== "decline") return NextResponse.json({ error: "action must be accept|decline" }, { status: 400 })

    const [b] = await db
      .select({
        id: bookings.id, providerId: bookings.providerId, scheduledAt: bookings.scheduledAt,
        scheduledEndAt: bookings.scheduledEndAt, pendingProposal: bookings.pendingProposal,
        platformFeePercent: bookings.platformFeePercent, carbonOffsetAmount: bookings.carbonOffsetAmount,
        customerId: bookings.customerId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ["payment_authorized", "confirmed"])))
    if (!b?.pendingProposal) return NextResponse.json({ error: "No pending proposal" }, { status: 404 })
    const p = b.pendingProposal

    const [prov] = await db
      .select({ userId: providers.userId, stripeAccountId: providers.stripeAccountId })
      .from(providers)
      .where(eq(providers.id, b.providerId))

    // The responder must be the OTHER party on this booking — never whoever proposed it.
    const callerRole: "client" | "provider" | null = b.customerId === userId ? "client" : prov?.userId === userId ? "provider" : null
    if (!callerRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (callerRole === p.proposedBy) return NextResponse.json({ error: "You proposed this change — waiting on the other party to respond." }, { status: 403 })

    async function notifyProposer(title: string, body: string) {
      const targetUserId = p.proposedBy === "provider" ? prov?.userId : b.customerId
      if (!targetUserId) return
      await db.insert(notifications).values({
        userId: targetUserId, type: "booking_rescheduled", title, body,
        link: p.proposedBy === "provider" ? "/provider/bookings" : `/bookings/${bookingId}`,
        metadata: { variant: action === "decline" ? "proposal_declined" : "proposal_accepted" },
      })
    }

    if (action === "decline") {
      await db.update(bookings).set({ pendingProposal: null, updatedAt: new Date() }).where(eq(bookings.id, bookingId))
      await notifyProposer("Suggestion declined", "The other party declined your suggested changes — the booking stays as originally agreed.")
      return NextResponse.json({ success: true })
    }

    // ACCEPT — work out the new schedule and (if rate changed) the new money.
    const newStart = p.scheduledAt ? new Date(p.scheduledAt) : new Date(b.scheduledAt)
    const oldDurMin = b.scheduledEndAt
      ? Math.round((new Date(b.scheduledEndAt).getTime() - new Date(b.scheduledAt).getTime()) / 60_000)
      : 120
    const durMin = p.durationMinutes ?? oldDurMin
    const newEnd = new Date(newStart.getTime() + durMin * 60_000)

    if (p.scheduledAt) {
      // Same protections the old standalone reschedule endpoint had — can't move the time within
      // 12 hours of the CURRENT appointment (cancel instead), and the new slot must still be free.
      const hoursUntilCurrent = (new Date(b.scheduledAt).getTime() - Date.now()) / 3_600_000
      if (hoursUntilCurrent < 12) {
        return NextResponse.json({ error: "This booking is within 12 hours of its appointment — too late to reschedule. Cancel instead if you need to change it now." }, { status: 422 })
      }
      const avail = await checkProviderAvailable(b.providerId, newStart)
      if (!avail.ok) return NextResponse.json({ error: avail.reason }, { status: 409 })

      const conflicting = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(
          eq(bookings.providerId, b.providerId),
          inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture"]),
          ne(bookings.id, bookingId),
          lte(bookings.scheduledAt, newEnd),
          gte(bookings.scheduledEndAt, newStart),
        ))
      if (conflicting.length > 0) return NextResponse.json({ error: "The cleaner already has another booking at that time." }, { status: 409 })
    }

    const updates: Record<string, unknown> = {
      scheduledAt: newStart, scheduledEndAt: newEnd, pendingProposal: null, updatedAt: new Date(),
    }

    if (p.hourlyCents) {
      const newSubtotal = Math.round((p.hourlyCents * durMin) / 60)
      const fee = Math.round((newSubtotal * b.platformFeePercent) / 100)
      const offset = b.carbonOffsetAmount ?? 0

      const [pay] = await db.select({ pi: payments.stripePaymentIntentId, currency: payments.currency }).from(payments).where(eq(payments.bookingId, bookingId))
      if (!pay?.pi || !prov?.stripeAccountId) return NextResponse.json({ error: "Payment not found" }, { status: 409 })
      const oldPi = await stripe.paymentIntents.retrieve(pay.pi)
      const pmId = typeof oldPi.payment_method === "string" ? oldPi.payment_method : oldPi.payment_method?.id
      const custId = typeof oldPi.customer === "string" ? oldPi.customer : oldPi.customer?.id
      if (!pmId || !custId) return NextResponse.json({ error: "No saved card to re-authorize" }, { status: 409 })

      // New hold FIRST — if it fails (e.g. SCA required), nothing was lost and the proposal stays.
      let newPi
      try {
        newPi = await stripe.paymentIntents.create(
          {
            amount: newSubtotal + offset, currency: pay.currency ?? "eur", customer: custId, payment_method: pmId,
            off_session: true, confirm: true, capture_method: "manual", setup_future_usage: "off_session",
            application_fee_amount: fee + offset,
            transfer_data: { destination: prov.stripeAccountId },
            metadata: { clerk_customer_id: userId, provider_id: b.providerId, proposal_for: bookingId },
          },
          { idempotencyKey: `proposal-${bookingId}-${p.proposedAt}` },
        )
      } catch {
        return NextResponse.json({ error: "Your card could not authorize the new amount. Please check your payment method and try again." }, { status: 402 })
      }
      if (newPi.status !== "requires_capture") {
        try { await stripe.paymentIntents.cancel(newPi.id, undefined, { idempotencyKey: `cancel-${newPi.id}` }) } catch {}
        return NextResponse.json({ error: "Your card could not authorize the new amount. Please check your payment method and try again." }, { status: 402 })
      }
      try { await stripe.paymentIntents.cancel(pay.pi, undefined, { idempotencyKey: `cancel-${pay.pi}` }) } catch {}

      await db.update(payments).set({ stripePaymentIntentId: newPi.id, amount: newSubtotal + offset }).where(eq(payments.bookingId, bookingId))
      Object.assign(updates, { subtotalAmount: newSubtotal, platformFeeAmount: fee, totalAmount: newSubtotal, providerPayout: newSubtotal - fee })
    }

    await db.update(bookings).set(updates).where(eq(bookings.id, bookingId))

    // Reset reminders to the (possibly) new time.
    if (p.scheduledAt) {
      try { await inngest.send({ name: "booking/rescheduled", data: { bookingId, customerId: b.customerId, providerId: b.providerId } }) } catch { /* non-fatal */ }
    }
    await notifyProposer("Suggestion accepted", "The other party accepted your suggested changes — the booking has been updated.")
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/proposal-response POST]", err)
    void logError({ message: "[bookings/[id]/proposal-response POST]", error: err, route: "/api/bookings/[id]/proposal-response", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
