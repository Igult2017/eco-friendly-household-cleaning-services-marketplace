import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, users } from "@/lib/db/schema"
import { stripe, calculateBookingAmounts } from "@/lib/stripe/client"
import { bookingRatelimit } from "@/lib/redis/client"
import { paymentIntentSchema } from "@/lib/validations/booking"
import { and, eq } from "drizzle-orm"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await bookingRatelimit.limit(userId)
  if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  // Only customers may create payment intents
  const [caller] = await db.select({ role: users.role, email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users).where(eq(users.id, userId))
  if (!caller) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (caller.role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = paymentIntentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { providerId, serviceId, carbonOffsetCents = 0 } = parsed.data

  const [[provider], [service]] = await Promise.all([
    db.select({ id: providers.id, stripeAccountId: providers.stripeAccountId, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
      .from(providers).where(eq(providers.id, providerId)),
    db.select({ id: providerServices.id, basePrice: providerServices.basePrice })
      .from(providerServices)
      .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId), eq(providerServices.isActive, true))),
  ])

  if (!provider?.isApproved || provider.isSuspended) return NextResponse.json({ error: "Provider not available" }, { status: 422 })
  if (!provider.stripeAccountId) return NextResponse.json({ error: "Provider payment not set up" }, { status: 422 })
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

  const amounts = calculateBookingAmounts(service.basePrice)
  const totalWithOffset = amounts.totalCharged + carbonOffsetCents

  let stripeCustomerId: string | undefined
  const existing = await stripe.customers.search({ query: `metadata['clerk_id']:'${userId}'`, limit: 1 })
  if (existing.data[0]) {
    stripeCustomerId = existing.data[0].id
  } else {
    const fullName = [caller.firstName, caller.lastName].filter(Boolean).join(" ") || undefined
    const created = await stripe.customers.create(
      { email: caller.email ?? undefined, name: fullName, metadata: { clerk_id: userId } },
      { idempotencyKey: `cus-create-${userId}` },
    )
    stripeCustomerId = created.id
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: totalWithOffset,
      currency: "eur",
      capture_method: "manual",
      customer: stripeCustomerId,
      // Carbon offset stays with DORIX (added to platform fee), not paid to provider
      application_fee_amount: amounts.platformFee + carbonOffsetCents,
      transfer_data: { destination: provider.stripeAccountId },
      metadata: {
        clerk_customer_id: userId,
        provider_id: providerId,
        service_id: serviceId,
        carbon_offset_cents: String(carbonOffsetCents),
      },
    },
    { idempotencyKey: `pi-create-${userId}-${serviceId}-${Date.now()}` },
  )

  return NextResponse.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amounts: { ...amounts, carbonOffsetCents, totalCharged: totalWithOffset },
  })
}
