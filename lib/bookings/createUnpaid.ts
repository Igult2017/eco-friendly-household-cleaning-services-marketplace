import { db } from "@/lib/db"
import { bookings, providers, providerServices, bids, jobPosts, notifications, users } from "@/lib/db/schema"
import type { NewBooking } from "@/lib/db/schema/bookings"
import { and, eq, isNull, desc, inArray, lt, gt } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"
import { calculateBookingAmounts, stripe } from "@/lib/stripe/client"
import { getCommissionPct } from "@/lib/platform/settings"
import { checkProviderAvailable } from "./availability"
import { BookingError, generateBookingNumber } from "./create"
import type { CreateBookingInput } from "@/lib/validations/booking"

// Booking WITHOUT a payment hold (status pending_payment, no Stripe PI). Two ways here: the client
// skipped adding a card, OR they saved a card but the cleaner's payout account isn't connected yet so
// no hold can be authorized. There is NO offline settlement — the booking can't be taken/completed
// until a hold exists (/bookings/[id]/pay); the notifications below differ by which case this is.
export async function createUnpaidBooking(userId: string, data: CreateBookingInput) {
  const { providerId, serviceId, scheduledAt, durationMinutes, serviceAddress, serviceLatitude, serviceLongitude, specialInstructions, ecoOptions } = data

  const [provider] = await db
    .select({ id: providers.id, userId: providers.userId, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
    .from(providers)
    .where(eq(providers.id, providerId))
  if (!provider?.isApproved || provider.isSuspended) throw new BookingError(422, "Provider not available")

  // Price: an accepted, unbooked bid for this client+cleaner wins (whole-job total, consumed below);
  // otherwise the service's price (per_hour × booked hours, mirroring the paid path).
  const [acceptedBid] = await db
    .select({ id: bids.id, amount: bids.amount })
    .from(bids)
    .innerJoin(jobPosts, eq(bids.jobPostId, jobPosts.id))
    .where(and(eq(bids.providerId, providerId), eq(bids.status, "accepted"), isNull(bids.bookingId), eq(jobPosts.customerId, userId)))
    .orderBy(desc(bids.createdAt))
    .limit(1)

  let [service] = serviceId
    ? await db
        .select({ id: providerServices.id, basePrice: providerServices.basePrice, priceUnit: providerServices.priceUnit })
        .from(providerServices)
        .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId), eq(providerServices.isActive, true)))
    : [undefined]
  if (!service) {
    ;[service] = await db
      .select({ id: providerServices.id, basePrice: providerServices.basePrice, priceUnit: providerServices.priceUnit })
      .from(providerServices)
      .where(and(eq(providerServices.providerId, providerId), eq(providerServices.isActive, true)))
      .limit(1)
  }
  if (!service) throw new BookingError(422, "This cleaner hasn't finished setting up their services yet.")

  const subtotal =
    acceptedBid?.amount ??
    (service.priceUnit === "per_hour" ? Math.round((service.basePrice * durationMinutes) / 60) : service.basePrice)
  const commissionPct = await getCommissionPct()
  const amounts = calculateBookingAmounts(subtotal, commissionPct)

  const avail = await checkProviderAvailable(providerId, new Date(scheduledAt))
  if (!avail.ok) throw new BookingError(409, avail.reason ?? "The cleaner is not available at that time.")

  const scheduledEnd = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60_000)
  const overlap = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.providerId, providerId),
      inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress", "pending_capture"]),
      lt(bookings.scheduledAt, scheduledEnd),
      gt(bookings.scheduledEndAt, new Date(scheduledAt)),
    ))
    .limit(1)
  if (overlap.length > 0) throw new BookingError(409, "This cleaner is already booked at that time. Please choose another slot.")

  const bookingNumber = await generateBookingNumber()
  const insertData: NewBooking = {
    bookingNumber,
    customerId: userId,
    providerId,
    serviceId: service.id,
    status: "pending_payment",
    scheduledAt: new Date(scheduledAt),
    scheduledEndAt: scheduledEnd,
    serviceAddress,
    serviceLatitude: serviceLatitude ?? null,
    serviceLongitude: serviceLongitude ?? null,
    specialInstructions: specialInstructions ?? null,
    ecoOptionsSelected: ecoOptions,
    platformFeePercent: commissionPct,
    subtotalAmount: subtotal,
    platformFeeAmount: amounts.platformFee,
    totalAmount: amounts.totalCharged,
    providerPayout: amounts.providerPayout,
    carbonOffsetAmount: 0,
    completionPhotoUrls: [],
    discountAmount: 0,
    requestedFrequency: data.requestedFrequency ?? null,
    requestedDays: data.requestedDays?.length ? data.requestedDays : null,
  }
  const [nb] = await db.insert(bookings).values(insertData).returning({ id: bookings.id, bookingNumber: bookings.bookingNumber })
  if (acceptedBid) {
    await db.update(bids).set({ bookingId: nb.id }).where(and(eq(bids.id, acceptedBid.id), isNull(bids.bookingId)))
  }

  // Normal new-booking flow (cleaner notification + reminders)…
  try { await inngest.send({ name: "booking/created", data: { bookingId: nb.id, customerId: userId, providerId } }) } catch { /* non-fatal */ }

  // Card on file changes the message materially: the client DID their part — what's missing is the
  // hold, usually because the CLEANER's payout account isn't connected yet.
  let hasCard = false
  try {
    const [u] = await db.select({ stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, userId))
    if (u?.stripeCustomerId) {
      const pms = await stripe.paymentMethods.list({ customer: u.stripeCustomerId, type: "card", limit: 1 })
      hasCard = pms.data.length > 0
    }
  } catch { /* treat as no card */ }

  try {
    if (hasCard) {
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "booking_reminder",
        title: "Client's card is on file — payment not yet secured",
        body: "This client saved a payment method for the booking, but the payment hold couldn't be authorized yet. If you haven't connected your payout account in Earnings, do it now — then the client can authorize and you can take the order.",
        link: "/provider/earnings",
        metadata: { variant: "booking_card_on_file" },
      })
      await db.insert(notifications).values({
        userId,
        type: "booking_reminder",
        title: "Card saved — booking created",
        body: "Your card is saved and nothing is charged before the work is done. Once your cleaner finishes their payout setup, authorize the payment here so they can accept the order.",
        link: `/bookings/${nb.id}/pay`,
        metadata: { variant: "client_card_saved_wait" },
      })
    } else {
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "booking_reminder",
        title: "No payment method on file — don't accept yet",
        body: "This client booked without adding a payment method. Ask them in the chat to add it — you can take the order once it's added, and payment is then collected automatically after you both confirm completion.",
        link: "/provider/bookings",
        metadata: { variant: "booking_no_card" },
      })
      // …and prompt the CLIENT: cleaners only take orders with a payment method on file, and adding
      // one never charges before the work is done.
      await db.insert(notifications).values({
        userId,
        type: "booking_reminder",
        title: "Add a payment method so your cleaner can accept",
        body: "Cleaners only accept orders from clients with a payment method on file. Adding one does NOT charge you — payment is only collected after the work is done and you both confirm.",
        link: `/bookings/${nb.id}/pay`,
        metadata: { variant: "client_add_payment_prompt" },
      })
    }
  } catch { /* non-fatal */ }

  return { bookingId: nb.id, bookingNumber: nb.bookingNumber }
}
