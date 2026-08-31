import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, users, notifications } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { getOrCreateStripeCustomer } from "@/lib/stripe/getOrCreateCustomer"
import { getCurrencyForCountry } from "@/lib/utils/locale"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Attach/re-attach a payment method to a booking that needs one. Every booking is created with a
// card now, so both statuses that reach here are RECOVERY cases, not the original creation:
// - pending_payment: an off-session recharge (e.g. after a recurring occurrence) failed and the
//   booking was downgraded to this status (lib/inngest/functions/completion.ts / recurring.ts).
// - pending_capture: the job is already done, but the original hold expired and the automatic
//   off-session recharge failed (lib/inngest/functions/completion.ts) — same recovery mechanism,
//   reused rather than building a second one, since an ON-SESSION retry here handles both "the
//   card was genuinely declined" and "the card needed a fresh 3D-Secure check" the same way Stripe
//   already handles it on this page (PaymentElement + confirmPayment naturally prompts for it).
// POST  → creates the manual-capture hold (card saved for off-session capture) and returns clientSecret.
// PATCH → after the client confirms the card, verifies the PI and reconciles the booking/payment rows.
const PAYABLE_STATUSES = ["pending_payment", "pending_capture"] as const

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
    if (!PAYABLE_STATUSES.includes(b.status as typeof PAYABLE_STATUSES[number])) {
      return NextResponse.json({ error: "This booking already has a payment method." }, { status: 422 })
    }

    const [prov] = await db
      .select({ stripeAccountId: providers.stripeAccountId, stripeAccountStatus: providers.stripeAccountStatus, country: providers.country })
      .from(providers)
      .where(eq(providers.id, b.providerId))
    if (!prov?.stripeAccountId || (prov.stripeAccountStatus && prov.stripeAccountStatus !== "active")) {
      return NextResponse.json({ error: "This cleaner hasn't finished their payout setup yet. Please try again later." }, { status: 422 })
    }

    // Single shared resolver — see lib/stripe/getOrCreateCustomer.ts for why every payment
    // flow must resolve the Stripe customer the same way.
    const stripeCustomerId = await getOrCreateStripeCustomer(userId)

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

    // Idempotent only for a genuine repeat of the SAME confirmed PI. A recovery re-payment
    // (pending_capture — the original hold lapsed and the automatic recharge failed) reaches here
    // with an EXISTING payments row still pointing at the old, now-dead PaymentIntent — that row
    // must be updated to the new one, not skipped as "already done".
    const [existing] = await db.select({ id: payments.id, stripePaymentIntentId: payments.stripePaymentIntentId }).from(payments).where(eq(payments.bookingId, id))
    if (existing?.stripePaymentIntentId === paymentIntentId) return NextResponse.json({ success: true })

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

    const paymentValues = {
      customerId: userId, stripePaymentIntentId: pi.id,
      stripeCustomerId: typeof pi.customer === "string" ? pi.customer : (pi.customer?.id ?? null),
      status: "authorized" as const, amount: pi.amount, capturedAmount: 0, refundedAmount: 0,
      currency: pi.currency,
    }
    if (existing) {
      await db.update(payments).set(paymentValues).where(eq(payments.id, existing.id))
    } else {
      await db.insert(payments).values({ bookingId: id, ...paymentValues, idempotencyKey: pi.id })
    }
    // pending_payment (no card at all) → payment_authorized, the normal next step. pending_capture
    // (recovering a lapsed, failed-to-recharge hold) stays pending_capture unchanged — the job is
    // already done in real life; the hourly capture sweeper picks up this fresh, valid PI on its
    // own next run and captures it, exactly like a normal lapsed-hold recovery.
    if (b.status === "pending_payment") {
      await db.update(bookings).set({ status: "payment_authorized" }).where(and(eq(bookings.id, id), eq(bookings.status, "pending_payment")))
    }

    // Tell the cleaner. Different message depending on which case this was: a brand-new order now
    // safe to take, vs. an already-completed job whose payment just needed to be re-secured.
    const [pv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, b.providerId))
    if (pv) {
      await db.insert(notifications).values(
        b.status === "pending_payment"
          ? {
              userId: pv.userId, type: "booking_confirmed" as const,
              title: "Payment method added", body: "The client added their payment method — payment is secured and will be collected automatically after you both confirm completion. You can take the order.",
              link: "/provider/bookings", metadata: { variant: "client_added_payment" },
            }
          : {
              userId: pv.userId, type: "payment_received" as const,
              title: "Payment secured", body: "The client re-secured payment for a completed job — you'll be paid automatically the next time payouts run.",
              link: "/provider/earnings", metadata: { variant: "client_recovered_payment" },
            },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/pay PATCH]", err)
    void logError({ message: "[bookings/[id]/pay PATCH]", error: err, route: "/api/bookings/[id]/pay", severity: "critical" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
