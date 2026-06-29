import { db } from "@/lib/db"
import { bookings, payments, providers, notifications } from "@/lib/db/schema"
import { eq, and, inArray, sql } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { inngest } from "@/lib/inngest/client"
import { redis } from "@/lib/redis/client"
import { findProvidersNearLocation } from "@/lib/db/queries/geo"
import { checkProviderAvailable } from "@/lib/bookings/availability"

const ACTIVE = ["payment_authorized", "confirmed", "in_progress"] as const

async function genBookingNumber(): Promise<string> {
  let seq: number
  try {
    seq = await redis.incr("booking:seq")
  } catch {
    const rows = await db.execute(sql`SELECT nextval('booking_seq') AS seq`)
    seq = Number((rows as unknown as Array<{ seq: string | number }>)[0]?.seq ?? Date.now())
  }
  return `BK-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`
}

/**
 * Auto-reassign an OVERDUE booking to another nearby cleaner. Because nothing is captured until
 * completion (the original is just a pre-auth hold), we: (1) pre-auth a NEW hold on the client's saved
 * card to the new cleaner, then — only if that succeeds — (2) release the old hold + cancel the
 * original and (3) create the new booking. New-hold-before-cancel ordering means a failure never
 * leaves the client with no booking. Returns ok:false (with a reason) so the caller can fall back to
 * notifying admin. (Off-session EU cards may need SCA → charge fails → admin fallback.)
 */
export async function attemptReassign(bookingId: string): Promise<{ ok: boolean; newBookingId?: string; reason?: string }> {
  const [b] = await db
    .select({
      status: bookings.status, customerId: bookings.customerId, providerId: bookings.providerId,
      serviceId: bookings.serviceId, serviceAddress: bookings.serviceAddress,
      serviceLatitude: bookings.serviceLatitude, serviceLongitude: bookings.serviceLongitude,
      specialInstructions: bookings.specialInstructions, ecoOptionsSelected: bookings.ecoOptionsSelected,
      platformFeePercent: bookings.platformFeePercent, subtotalAmount: bookings.subtotalAmount,
      platformFeeAmount: bookings.platformFeeAmount, totalAmount: bookings.totalAmount,
      providerPayout: bookings.providerPayout, carbonOffsetAmount: bookings.carbonOffsetAmount,
      discountAmount: bookings.discountAmount, scheduledAt: bookings.scheduledAt, scheduledEndAt: bookings.scheduledEndAt,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))

  if (!b) return { ok: false, reason: "not_found" }
  if (!ACTIVE.includes(b.status as (typeof ACTIVE)[number])) return { ok: false, reason: "not_active" }
  if (b.serviceLatitude == null || b.serviceLongitude == null) return { ok: false, reason: "no_location" }

  const [pay] = await db.select({ pi: payments.stripePaymentIntentId, currency: payments.currency }).from(payments).where(eq(payments.bookingId, bookingId))
  if (!pay?.pi) return { ok: false, reason: "no_payment" }

  // Saved card + customer from the original pre-auth.
  const origPi = await stripe.paymentIntents.retrieve(pay.pi)
  const pmId = typeof origPi.payment_method === "string" ? origPi.payment_method : origPi.payment_method?.id
  const custId = typeof origPi.customer === "string" ? origPi.customer : origPi.customer?.id
  if (!pmId || !custId) return { ok: false, reason: "no_saved_card" }

  // Nearby candidates (exclude the original), then keep only approved + payout-ready.
  const near = await findProvidersNearLocation({ latitude: b.serviceLatitude, longitude: b.serviceLongitude, radiusKm: 50, limit: 12 })
  const ids = near.map((p) => p.id).filter((id) => id !== b.providerId)
  if (!ids.length) return { ok: false, reason: "no_candidates" }
  const eligible = await db
    .select({ id: providers.id, stripeAccountId: providers.stripeAccountId, businessName: providers.businessName })
    .from(providers)
    .where(and(inArray(providers.id, ids), eq(providers.stripeAccountStatus, "active"), eq(providers.isApproved, true), eq(providers.isSuspended, false)))
  const ordered = ids.map((id) => eligible.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e?.stripeAccountId)

  // Propose tomorrow, same duration; pick the nearest candidate who's available then.
  const proposedStart = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const durMs = b.scheduledEndAt ? new Date(b.scheduledEndAt).getTime() - new Date(b.scheduledAt).getTime() : 2 * 60 * 60 * 1000
  const proposedEnd = new Date(proposedStart.getTime() + durMs)

  let chosen: (typeof ordered)[number] | null = null
  for (const c of ordered) {
    const avail = await checkProviderAvailable(c.id, proposedStart)
    if (avail.ok) { chosen = c; break }
  }
  if (!chosen) return { ok: false, reason: "none_available" }

  const amount = b.totalAmount + (b.carbonOffsetAmount ?? 0)
  const currency = pay.currency ?? "eur"

  // 1) NEW hold first (off-session) — if this fails (e.g. SCA), bail BEFORE cancelling the original.
  let newPi
  try {
    newPi = await stripe.paymentIntents.create(
      {
        amount, currency, customer: custId, payment_method: pmId,
        off_session: true, confirm: true, capture_method: "manual", setup_future_usage: "off_session",
        application_fee_amount: b.platformFeeAmount + (b.carbonOffsetAmount ?? 0),
        transfer_data: { destination: chosen.stripeAccountId! },
        metadata: { clerk_customer_id: b.customerId, provider_id: chosen.id, service_id: b.serviceId ?? "", reassigned_from: bookingId },
      },
      { idempotencyKey: `reassign-pi-${bookingId}` },
    )
  } catch {
    return { ok: false, reason: "charge_failed" }
  }
  if (newPi.status !== "requires_capture") {
    try { await stripe.paymentIntents.cancel(newPi.id) } catch {}
    return { ok: false, reason: "not_authorized" }
  }

  // 2) Release the old hold + cancel the original.
  try { await stripe.paymentIntents.cancel(pay.pi) } catch {}
  await db.update(bookings).set({ status: "cancelled", cancellationReason: "Overdue — reassigned to another cleaner", cancelledAt: new Date(), cancelledBy: "system" }).where(eq(bookings.id, bookingId))
  await db.update(payments).set({ status: "cancelled" }).where(eq(payments.bookingId, bookingId))

  // 3) Create the new booking + payment.
  const bookingNumber = await genBookingNumber()
  const [nb] = await db
    .insert(bookings)
    .values({
      bookingNumber, customerId: b.customerId, providerId: chosen.id, serviceId: b.serviceId,
      status: "payment_authorized", scheduledAt: proposedStart, scheduledEndAt: proposedEnd,
      serviceAddress: b.serviceAddress, serviceLatitude: b.serviceLatitude, serviceLongitude: b.serviceLongitude,
      specialInstructions: b.specialInstructions ?? null, ecoOptionsSelected: (b.ecoOptionsSelected as string[]) ?? [],
      platformFeePercent: b.platformFeePercent, subtotalAmount: b.subtotalAmount, platformFeeAmount: b.platformFeeAmount,
      totalAmount: b.totalAmount, providerPayout: b.providerPayout, carbonOffsetAmount: b.carbonOffsetAmount ?? 0,
      discountAmount: b.discountAmount ?? 0, completionPhotoUrls: [],
    })
    .returning({ id: bookings.id })

  await db.insert(payments).values({
    bookingId: nb.id, customerId: b.customerId, stripePaymentIntentId: newPi.id, stripeCustomerId: custId,
    status: "authorized", amount, currency, idempotencyKey: newPi.id,
  })

  // 4) Standard new-booking flow (reminders + confirmation + notify the new cleaner).
  try { await inngest.send({ name: "booking/created", data: { bookingId: nb.id, customerId: b.customerId, providerId: chosen.id } }) } catch { /* non-fatal */ }

  // 5) Tell the client + the original cleaner.
  await db.insert(notifications).values({ userId: b.customerId, type: "booking_rescheduled", title: "Booking reassigned", body: `Your overdue booking has been reassigned to ${chosen.businessName}.`, link: `/bookings/${nb.id}`, metadata: { variant: "booking_reassigned_client" } })
  const [origProv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, b.providerId))
  if (origProv) {
    await db.insert(notifications).values({ userId: origProv.userId, type: "booking_cancelled", title: "Booking removed", body: "An overdue booking was removed and reassigned to another cleaner.", link: "/provider/bookings", metadata: { variant: "booking_reassigned_away" } })
  }

  return { ok: true, newBookingId: nb.id }
}
