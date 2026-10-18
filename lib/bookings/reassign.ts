import { db } from "@/lib/db"
import { bookings, payments, providers, notifications } from "@/lib/db/schema"
import { eq, and, inArray, sql } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { inngest } from "@/lib/inngest/client"
import { redis } from "@/lib/redis/client"
import { findProvidersNearLocation } from "@/lib/db/queries/geo"
import { checkProviderAvailable } from "@/lib/bookings/availability"
import { requireIdentityOnAward } from "@/lib/bookings/identityGate"

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
export async function attemptReassign(
  bookingId: string,
  opts: {
    /**
     * Keep the client's ORIGINAL date and time instead of proposing tomorrow. Tomorrow is right when
     * a cleaner simply never turned up (the slot is already gone), but wrong when the cleaner is
     * being swapped before the job: a client who booked Tuesday 09:00 should still get Tuesday 09:00.
     */
    keepOriginalSlot?: boolean
    /** Why the swap happened — decides what the client and the old cleaner are told. */
    reason?: "overdue" | "identity" | "unconfirmed"
  } = {},
): Promise<{ ok: boolean; newBookingId?: string; reason?: string }> {
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
    .select({
      id: providers.id,
      stripeAccountId: providers.stripeAccountId,
      businessName: providers.businessName,
      verificationStatus: providers.verificationStatus,
    })
    .from(providers)
    .where(
      and(
        inArray(providers.id, ids),
        eq(providers.stripeAccountStatus, "active"),
        eq(providers.isApproved, true),
        eq(providers.isSuspended, false),
      ),
    )
  const byDistance = ids
    .map((id) => eligible.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e?.stripeAccountId)

  // Identity is a PREFERENCE, not a filter: already-verified cleaners are tried first (nearest
  // first), and only if none of them can take it does it fall to an unverified cleaner — who then
  // has to pass the same check to keep it, exactly as on a first job.
  //
  // A hard filter was the wrong shape. Today not one cleaner is verified, so "verified only" would
  // find nobody for every job and reassignment would never happen at all. Preferring instead of
  // requiring means the feature works on day one and gets stricter by itself as cleaners verify.
  const ordered = [
    ...byDistance.filter((c) => c.verificationStatus === "verified"),
    ...byDistance.filter((c) => c.verificationStatus !== "verified"),
  ]

  // Propose tomorrow, same duration; pick the nearest candidate who's available then.
  // Tomorrow for a no-show (the original slot has already passed); the original slot when the
  // cleaner is being swapped before the job, because the client chose that time.
  const proposedStart = opts.keepOriginalSlot
    ? new Date(b.scheduledAt)
    : new Date(Date.now() + 24 * 60 * 60 * 1000)
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
    try { await stripe.paymentIntents.cancel(newPi.id, undefined, { idempotencyKey: `cancel-${newPi.id}` }) } catch {}
    return { ok: false, reason: "not_authorized" }
  }

  // 1b) RE-RUN GUARD. This whole function runs inside an Inngest step with retries. The
  // PaymentIntent above is idempotency-keyed, so a retry gets the SAME one back — but the booking
  // insert below is not, so a retry used to add a second booking, and the payment insert then hit
  // the unique index on stripe_payment_intent_id and threw, retrying again. The client and the new
  // cleaner were left looking at orphan bookings that no payment backed.
  const [already] = await db
    .select({ bookingId: payments.bookingId })
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, newPi.id))
  if (already?.bookingId) return { ok: true, newBookingId: already.bookingId }

  // 2) Release the old hold + cancel the original.
  try { await stripe.paymentIntents.cancel(pay.pi, undefined, { idempotencyKey: `cancel-${pay.pi}` }) } catch {}
  // The reason recorded must be the reason it actually happened — this said "Overdue" even for an
  // identity swap or an unanswered availability check, which made the audit trail wrong.
  const cancellationReason =
    opts.reason === "identity"
      ? "Identity not verified — reassigned to another cleaner"
      : opts.reason === "unconfirmed"
        ? "Cleaner did not confirm availability — reassigned to another cleaner"
        : "Overdue — reassigned to another cleaner"
  await db.update(bookings).set({ status: "cancelled", cancellationReason, cancelledAt: new Date(), cancelledBy: "system" }).where(eq(bookings.id, bookingId))
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

  // If the job fell to an UNVERIFIED cleaner because no verified one could take it, they inherit the
  // same requirement: verify to keep it, exactly as on a first job. Without this the fallback would
  // be a way around the check — the surest route to an unverified cleaner in a client's home would
  // be to wait for a reassignment.
  if (chosen.verificationStatus !== "verified") {
    try {
      await requireIdentityOnAward({ bookingId: nb.id, providerId: chosen.id })
    } catch (gateErr) {
      console.error("[bookings/reassign] identity hold not set on the replacement booking:", gateErr)
    }
  }

  // 5) Tell the client + the original cleaner.
  // Told only NOW, once the job is actually re-awarded — so the client never hears "your cleaner
  // failed a check" while sitting with no cleaner at all. The identity wording says plainly what
  // happened and why, because a silent change of the person entering their home is worse than an
  // uncomfortable explanation.
  const identity = opts.reason === "identity"
  const unconfirmed = opts.reason === "unconfirmed"
  await db.insert(notifications).values({
    userId: b.customerId,
    type: "booking_rescheduled",
    title: identity
      ? "Your cleaner has been changed for your safety"
      : unconfirmed
        ? "Your cleaner has been changed"
        : "Booking reassigned",
    body: identity
      ? `The cleaner you booked did not verify their identity, so for your safety the job has been given to ${chosen.businessName}, whose identity we have confirmed. Your time is unchanged and you have not been charged anything extra.`
      : unconfirmed
        ? `We could not reach the cleaner you booked to confirm they were still coming, so rather than risk nobody arriving we have given the job to ${chosen.businessName}. Your time is unchanged and you have not been charged anything extra.`
        : `Your overdue booking has been reassigned to ${chosen.businessName}.`,
    link: `/bookings/${nb.id}`,
    metadata: { variant: "booking_reassigned_client" },
  })
  const [origProv] = await db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, b.providerId))
  if (origProv) {
    await db.insert(notifications).values({
      userId: origProv.userId,
      type: "booking_cancelled",
      title: identity
        ? "Job removed — identity not verified"
        : unconfirmed
          ? "Job removed — you did not confirm"
          : "Booking removed",
      body: identity
        ? "This job has been given to another cleaner because your identity was not verified in time. Verify your identity and you can take jobs again."
        : unconfirmed
          ? "We asked you to confirm you were still coming and did not hear back in time, so this job has been given to another cleaner. Keep an eye on your notifications so this does not happen again."
          : "An overdue booking was removed and reassigned to another cleaner.",
      link: "/provider/bookings",
      metadata: { variant: "booking_reassigned_away" },
    })
  }

  return { ok: true, newBookingId: nb.id }
}
