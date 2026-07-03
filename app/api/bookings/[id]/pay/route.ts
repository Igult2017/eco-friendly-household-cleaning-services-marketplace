import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, users, notifications } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { getCurrencyForCountry } from "@/lib/utils/locale"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Attach a payment method to a booking made WITHOUT one (status pending_payment).
// POST  → creates the manual-capture hold (card saved for off-session capture) and returns clientSecret.
// PATCH → after the client confirms the card, verifies the PI and flips the booking to payment_authorized.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })

    const [b] = await db
      .select({
        id: bookings.id, status: bookings.status, providerId: bookings.providerId,
        serviceId: bookings.serviceId, totalAmount: bookings.totalAmount,
        platformFeeAmount: bookings.platformFeeAmount, carbonOffsetAmount: bookings.carbonOffsetAmount,
      })
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)))
    if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (b.status !== "pending_payment") return NextResponse.json({ error: "This booking already has a payment method." }, { status: 422 })

    const [prov] = await db
      .select({ stripeAccountId: providers.stripeAccountId, stripeAccountStatus: providers.stripeAccountStatus, country: providers.country })
      .from(providers)
      .where(eq(providers.id, b.providerId))
    if (!prov?.stripeAccountId || (prov.stripeAccountStatus && prov.stripeAccountStatus !== "active")) {
      return NextResponse.json({ error: "This cleaner hasn't finished their payout setup yet. Please try again later." }, { status: 422 })
    }

    // One Stripe customer per user (same clerk_id convention as the other payment flows).
    const [u] = await db.select({ email: users.email, firstName: users.firstName, stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, userId))
    let stripeCustomerId = u?.stripeCustomerId ?? null
    if (!stripeCustomerId) {
      const existing = await stripe.customers.search({ query: `metadata['clerk_id']:'${userId}'`, limit: 1 })
      stripeCustomerId = existing.data[0]?.id ?? (await stripe.customers.create(
        { email: u?.email, name: u?.firstName ?? undefined, metadata: { clerk_id: userId } },
        { idempotencyKey: `cus-create-${userId}` },
      )).id
      await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId))
    }

    const offset = b.carbonOffsetAmount ?? 0
    const intent = await stripe.paymentIntents.create(
      {
        amount: b.totalAmount + offset,
        currency: getCurrencyForCountry(prov.country || "DE").toLowerCase(),
        customer: stripeCustomerId,
        capture_method: "manual",
        setup_future_usage: "off_session", // saved → automatic deduction at completion, even if the hold lapses
        application_fee_amount: b.platformFeeAmount + offset,
        transfer_data: { destination: prov.stripeAccountId },
        metadata: { clerk_customer_id: userId, provider_id: b.providerId, service_id: b.serviceId ?? "", booking_id: b.id },
      },
      { idempotencyKey: `latepay-${b.id}` },
    )
    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount: b.totalAmount + offset })
  } catch (err) {
    console.error("[bookings/[id]/pay POST]", err)
    void logError({ message: "[bookings/[id]/pay POST]", error: err, route: "/api/bookings/[id]/pay", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })
    const { paymentIntentId } = (await req.json().catch(() => ({}))) as { paymentIntentId?: string }
    if (!paymentIntentId) return NextResponse.json({ error: "paymentIntentId required" }, { status: 400 })

    // Idempotent: already attached → done.
    const [existing] = await db.select({ id: payments.id }).from(payments).where(eq(payments.bookingId, id))
    if (existing) return NextResponse.json({ success: true })

    const [b] = await db
      .select({ status: bookings.status, providerId: bookings.providerId })
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)))
    if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status !== "requires_capture") return NextResponse.json({ error: "Payment not authorized" }, { status: 422 })
    if (pi.metadata.booking_id !== id || pi.metadata.clerk_customer_id !== userId) {
      return NextResponse.json({ error: "Intent mismatch" }, { status: 403 })
    }

    await db.insert(payments).values({
      bookingId: id, customerId: userId, stripePaymentIntentId: pi.id,
      stripeCustomerId: typeof pi.customer === "string" ? pi.customer : (pi.customer?.id ?? null),
      status: "authorized", amount: pi.amount, capturedAmount: 0, refundedAmount: 0,
      currency: pi.currency, idempotencyKey: pi.id,
    })
    await db.update(bookings).set({ status: "payment_authorized" }).where(and(eq(bookings.id, id), eq(bookings.status, "pending_payment")))

    // Tell the cleaner the order is now safe to take.
    const [pv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, b.providerId))
    if (pv) {
      await db.insert(notifications).values({
        userId: pv.userId, type: "booking_confirmed",
        title: "Payment method added", body: "The client added their payment method — payment is secured and will be collected automatically after you both confirm completion. You can take the order.",
        link: "/provider/bookings", metadata: { variant: "client_added_payment" },
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/pay PATCH]", err)
    void logError({ message: "[bookings/[id]/pay PATCH]", error: err, route: "/api/bookings/[id]/pay", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
