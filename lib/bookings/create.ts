import { db } from "@/lib/db"
import { bookings, payments, providers, providerServices, carbonOffsetContributions, promoCodes, promoCodeUsages } from "@/lib/db/schema"
import type { NewBooking } from "@/lib/db/schema/bookings"
import { stripe, calculateBookingAmounts } from "@/lib/stripe/client"
import { getCommissionPct } from "@/lib/platform/settings"
import { inngest } from "@/lib/inngest/client"
import { redis } from "@/lib/redis/client"
import { eq, and, sql } from "drizzle-orm"
import type { CreateBookingInput } from "@/lib/validations/booking"

async function generateBookingNumber(): Promise<string> {
  const seq = await redis.incr("booking:seq")
  return `BK-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`
}

export class BookingError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export async function createBooking(userId: string, data: CreateBookingInput) {
  const {
    providerId, serviceId, paymentIntentId,
    scheduledAt, durationMinutes, serviceAddress,
    serviceLatitude, serviceLongitude, specialInstructions,
    ecoOptions, carbonOffsetCents = 0,
  } = data

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (intent.status !== "requires_capture") {
    throw new BookingError(422, "Payment not authorized")
  }

  const cancel = async (status: number, msg: string): Promise<never> => {
    try { await stripe.paymentIntents.cancel(paymentIntentId) } catch {}
    throw new BookingError(status, msg)
  }

  if (intent.metadata.clerk_customer_id !== userId) await cancel(403, "Intent mismatch")
  if (intent.metadata.provider_id !== providerId) await cancel(403, "Intent mismatch")
  if (intent.metadata.service_id !== serviceId) await cancel(403, "Intent mismatch")
  if (intent.metadata.carbon_offset_cents !== String(carbonOffsetCents)) await cancel(403, "Intent mismatch")

  const [[service], [provider]] = await Promise.all([
    db.select({ basePrice: providerServices.basePrice })
      .from(providerServices)
      .where(and(eq(providerServices.id, serviceId), eq(providerServices.isActive, true))),
    db.select({ id: providers.id, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
      .from(providers)
      .where(eq(providers.id, providerId)),
  ])

  if (!service) await cancel(404, "Service not found")
  if (!provider?.isApproved || provider.isSuspended) await cancel(422, "Provider not available")

  // Bug 5: use bid amount from PI metadata when present (bid-flow bookings)
  const bidAmountCents = intent.metadata.bid_amount_cents ? parseInt(intent.metadata.bid_amount_cents, 10) : null
  // Add-ons were summed + validated server-side at PI creation; their total rides in metadata.
  const addOnsTotal = intent.metadata.addon_total_cents ? parseInt(intent.metadata.addon_total_cents, 10) : 0
  const subtotal = (bidAmountCents ?? service!.basePrice) + addOnsTotal

  // Promo code from PI metadata
  const promoCodeId = intent.metadata.promo_code_id ?? null
  const discountCents = intent.metadata.promo_code_discount_cents ? parseInt(intent.metadata.promo_code_discount_cents, 10) : 0
  const subtotalAfterDiscount = Math.max(0, subtotal - discountCents)
  const commissionPct = await getCommissionPct()
  const amounts = calculateBookingAmounts(subtotalAfterDiscount, commissionPct)
  const bookingNumber = await generateBookingNumber()
  const scheduledEnd = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60_000)

  const insertData: NewBooking = {
    bookingNumber,
    customerId: userId,
    providerId,
    serviceId,
    status: "payment_authorized",
    scheduledAt: new Date(scheduledAt),
    scheduledEndAt: scheduledEnd,
    serviceAddress,
    serviceLatitude: serviceLatitude ?? null,
    serviceLongitude: serviceLongitude ?? null,
    specialInstructions: specialInstructions ?? null,
    ecoOptionsSelected: ecoOptions,
    platformFeePercent: commissionPct,
    subtotalAmount: subtotalAfterDiscount,
    platformFeeAmount: amounts.platformFee,
    totalAmount: amounts.totalCharged,
    providerPayout: amounts.providerPayout,
    carbonOffsetAmount: carbonOffsetCents,
    completionPhotoUrls: [],
    promoCodeId: promoCodeId ?? undefined,
    discountAmount: discountCents,
  }

  const result = await db.transaction(async (tx) => {
    const [newBooking] = await tx
      .insert(bookings)
      .values(insertData)
      .returning({ id: bookings.id, bookingNumber: bookings.bookingNumber })

    await tx.insert(payments).values({
      bookingId: newBooking.id,
      customerId: userId,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: typeof intent.customer === "string" ? intent.customer : (intent.customer?.id ?? null),
      status: "authorized",
      amount: amounts.totalCharged,
      capturedAmount: 0,
      refundedAmount: 0,
      currency: "eur",
      idempotencyKey: paymentIntentId,
    })

    if (carbonOffsetCents > 0) {
      await tx.insert(carbonOffsetContributions).values({
        bookingId: newBooking.id,
        customerId: userId,
        providerId,
        amount: carbonOffsetCents,
        offsetProvider: "DORIXÉ Green Fund",
      })
    }

    if (promoCodeId && discountCents > 0) {
      // Atomic conditional increment: only succeeds when the code is still within maxUses.
      // If two concurrent requests race past the earlier read-then-compare check, at most one
      // will get a row back here; the other will find 0 rows and the transaction aborts.
      const [updatedPromo] = await tx
        .update(promoCodes)
        .set({ usedCount: sql`used_count + 1` })
        .where(
          and(
            eq(promoCodes.id, promoCodeId),
            sql`(max_uses IS NULL OR used_count < max_uses)`,
          )
        )
        .returning({ id: promoCodes.id })

      if (!updatedPromo) {
        throw new BookingError(422, "Promo code usage limit reached")
      }

      await tx.insert(promoCodeUsages).values({
        promoCodeId,
        userId,
        bookingId: newBooking.id,
        discountAmount: discountCents,
      })
    }

    return newBooking
  })

  try {
    await inngest.send({ name: "booking/created", data: { bookingId: result.id, customerId: userId, providerId } })
  } catch {}

  return { bookingId: result.id, bookingNumber: result.bookingNumber }
}
