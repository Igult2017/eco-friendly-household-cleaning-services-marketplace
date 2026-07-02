import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, notifications } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { inngest } from "@/lib/inngest/client"
import { logError } from "@/lib/utils/logError"

// Client accepts or declines the cleaner's counter-offer. Accepting a new hourly rate re-authorizes
// the card OFF-SESSION for the new amount (new hold first, then release the old one) — the card was
// saved at booking via setup_future_usage. Accepting a new time reuses the reschedule mechanics.
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
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, userId), inArray(bookings.status, ["payment_authorized", "confirmed"])))
    if (!b?.pendingProposal) return NextResponse.json({ error: "No pending proposal" }, { status: 404 })
    const p = b.pendingProposal

    const [prov] = await db
      .select({ userId: providers.userId, stripeAccountId: providers.stripeAccountId })
      .from(providers)
      .where(eq(providers.id, b.providerId))

    if (action === "decline") {
      await db.update(bookings).set({ pendingProposal: null, updatedAt: new Date() }).where(eq(bookings.id, bookingId))
      if (prov) {
        await db.insert(notifications).values({
          userId: prov.userId, type: "booking_rescheduled", title: "Suggestion declined",
          body: "The client declined your suggested changes — the booking stays as originally agreed.",
          link: "/provider/bookings", metadata: { variant: "proposal_declined" },
        })
      }
      return NextResponse.json({ success: true })
    }

    // ACCEPT — work out the new schedule and (if rate changed) the new money.
    const newStart = p.scheduledAt ? new Date(p.scheduledAt) : new Date(b.scheduledAt)
    const oldDurMin = b.scheduledEndAt
      ? Math.round((new Date(b.scheduledEndAt).getTime() - new Date(b.scheduledAt).getTime()) / 60_000)
      : 120
    const durMin = p.durationMinutes ?? oldDurMin
    const newEnd = new Date(newStart.getTime() + durMin * 60_000)

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
        try { await stripe.paymentIntents.cancel(newPi.id) } catch {}
        return NextResponse.json({ error: "Your card could not authorize the new amount. Please check your payment method and try again." }, { status: 402 })
      }
      try { await stripe.paymentIntents.cancel(pay.pi) } catch {}

      await db.update(payments).set({ stripePaymentIntentId: newPi.id, amount: newSubtotal + offset }).where(eq(payments.bookingId, bookingId))
      Object.assign(updates, { subtotalAmount: newSubtotal, platformFeeAmount: fee, totalAmount: newSubtotal, providerPayout: newSubtotal - fee })
    }

    await db.update(bookings).set(updates).where(eq(bookings.id, bookingId))

    // Reset reminders to the (possibly) new time.
    if (p.scheduledAt) {
      try { await inngest.send({ name: "booking/rescheduled", data: { bookingId, customerId: b.customerId, providerId: b.providerId } }) } catch { /* non-fatal */ }
    }
    if (prov) {
      await db.insert(notifications).values({
        userId: prov.userId, type: "booking_rescheduled", title: "Suggestion accepted",
        body: "The client accepted your suggested changes — the booking has been updated.",
        link: "/provider/bookings", metadata: { variant: "proposal_accepted" },
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/proposal-response POST]", err)
    void logError({ message: "[bookings/[id]/proposal-response POST]", error: err, route: "/api/bookings/[id]/proposal-response", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
