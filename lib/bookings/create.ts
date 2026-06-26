import { db } from "@/lib/db"
import { bookings, payments, providers, providerServices, carbonOffsetContributions, promoCodes, promoCodeUsages } from "@/lib/db/schema"
import type { NewBooking } from "@/lib/db/schema/bookings"
import { stripe, calculateBookingAmounts } from "@/lib/stripe/client"
import { getCommissionPct } from "@/lib/platform/settings"
import { inngest } from "@/lib/inngest/client"
import { redis } from "@/lib/redis/client"
import { eq, and, sql, inArray, lte, gte } from "drizzle-orm"
import type { CreateBookingInput } from "@/lib/validations/booking"

async function generateBookingNumber(): Promise<string> {
  let seq: number
  try {
    seq = await redis.incr("booking:seq")
  } catch {
    // Redis outage — fall back to a DB sequence (created in the ensure-script, started high to avoid
    // colliding with the Redis-issued range) so booking creation doesn't 500 while Redis is down.
    const rows = await db.execute(sql`SELECT nextval('booking_seq') AS seq`)
    seq = Number((rows as unknown as Array<{ seq: string | number }>)[0]?.seq ?? Date.now())
  }
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
      .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId), eq(providerServices.isActive, true))),
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
  // FIN-010: use the commission rate pinned on the PI (set at PI creation) so the stored
  // split matches what Stripe was told, even if an admin changed the rate in between.
  const commissionPct = intent.metadata.commission_pct
    ? parseInt(intent.metadata.commission_pct, 10)
    : await getCommissionPct()
  const amounts = calculateBookingAmounts(subtotalAfterDiscount, commissionPct)
  // The PaymentIntent amount is the source of truth (the card is already held for it). If the
  // recomputed total drifted (e.g. the provider changed basePrice after the PI was created), abort
  // rather than store a split that doesn't match the money actually held/captured.
  if (amounts.totalCharged + carbonOffsetCents !== intent.amount) {
    await cancel(409, "The price changed since you started. Please review and try again.")
  }
  const bookingNumber = await generateBookingNumber()
  const scheduledEnd = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60_000)

  // Double-booking guard: reject if this provider already has an active booking overlapping the
  // requested window. The unique index only blocks identical start times, so overlapping durations
  // would otherwise slip through — and this also covers the bid-flow + direct API calls that bypass
  // the wizard's client-side availability check.
  const overlap = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.providerId, providerId),
      inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture"]),
      lte(bookings.scheduledAt, scheduledEnd),
      gte(bookings.scheduledEndAt, new Date(scheduledAt)),
    ))
    .limit(1)
  if (overlap.length > 0) await cancel(409, "This cleaner is already booked at that time. Please choose another slot.")

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

  let result: { id: string; bookingNumber: string }
  try {
  result = await db.transaction(async (tx) => {
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
  } catch (err) {
    // A concurrent same-slot booking that slipped past the overlap check loses the unique-index
    // race; release the loser's payment hold and surface a clean conflict instead of a 500.
    const pgErr = err as { code?: string; message?: string }
    // 23505 = unique-index race (identical start time); 23P01 = exclusion-constraint race
    // (overlapping window). Either way the slot is taken — release the hold + return 409.
    if (pgErr?.code === "23505" || pgErr?.code === "23P01" || /duplicate|exclusion|conflicting/i.test(pgErr?.message ?? "")) {
      await cancel(409, "That time slot was just taken. Please choose a different time.")
    }
    throw err
  }

  try {
    await inngest.send({ name: "booking/created", data: { bookingId: result.id, customerId: userId, providerId } })
  } catch {}

  return { bookingId: result.id, bookingNumber: result.bookingNumber }
}
