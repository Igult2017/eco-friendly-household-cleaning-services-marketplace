import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, providerServices } from "@/lib/db/schema"
import type { NewBooking } from "@/lib/db/schema/bookings"
import { stripe, calculateBookingAmounts } from "@/lib/stripe/client"
import { bookingRatelimit } from "@/lib/redis/client"
import { createBookingSchema } from "@/lib/validations/booking"
import { eq, and, count, desc } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"

async function generateBookingNumber(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(bookings)
  const num = String(Number(value) + 1).padStart(6, "0")
  return `BK-${new Date().getFullYear()}-${num}`
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await bookingRatelimit.limit(userId)
  if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  const body = await req.json()
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { providerId, serviceId, paymentIntentId, scheduledAt, durationMinutes, serviceAddress, serviceLatitude, serviceLongitude, specialInstructions, ecoOptions } = parsed.data

  // Verify PaymentIntent is in requires_capture state
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (intent.status !== "requires_capture") {
    return NextResponse.json({ error: "Payment not authorized" }, { status: 422 })
  }

  // Confirm the intent matches this user
  if (intent.metadata.clerk_customer_id !== userId || intent.metadata.provider_id !== providerId) {
    return NextResponse.json({ error: "Intent mismatch" }, { status: 403 })
  }

  const [service] = await db
    .select({ basePrice: providerServices.basePrice })
    .from(providerServices)
    .where(and(eq(providerServices.id, serviceId), eq(providerServices.isActive, true)))

  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.id, providerId))
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

  const amounts = calculateBookingAmounts(service.basePrice)
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
    platformFeePercent: 15,
    subtotalAmount: amounts.subtotalCents,
    platformFeeAmount: amounts.platformFee,
    totalAmount: amounts.totalCharged,
    providerPayout: amounts.providerPayout,
    carbonOffsetAmount: 0,
    completionPhotoUrls: [],
  }

  const [newBooking] = await db.insert(bookings).values(insertData).returning({ id: bookings.id, bookingNumber: bookings.bookingNumber })

  // Insert payment record
  await db.insert(payments).values({
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

  // Fire Inngest event for notifications + emails
  await inngest.send({ name: "booking/created", data: { bookingId: newBooking.id, customerId: userId, providerId } })

  return NextResponse.json({ bookingId: newBooking.id, bookingNumber: newBooking.bookingNumber }, { status: 201 })
}

export async function GET(_req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const customerBookings = await db.query.bookings.findMany({
    where: (b, { eq: eqFn }) => eqFn(b.customerId, userId),
    with: {
      provider: { columns: { businessName: true, slug: true, profilePhotoUrl: true } },
      service: { columns: { name: true, basePrice: true } },
    },
    orderBy: [desc(bookings.createdAt)],
    limit: 50,
  })

  return NextResponse.json({ bookings: customerBookings })
}
