import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerServices, users, bids, jobPosts, promoCodes, providerAddons } from "@/lib/db/schema"
import { stripe, calculateBookingAmounts } from "@/lib/stripe/client"
import { getCommissionPct } from "@/lib/platform/settings"
import { bookingRatelimit } from "@/lib/redis/client"
import { paymentIntentSchema } from "@/lib/validations/booking"
import { and, eq, inArray } from "drizzle-orm"
import { createHash } from "node:crypto"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const { success } = await bookingRatelimit.limit(userId)
      if (!success) return NextResponse.json({ error: "Rate limit exceeded. Please wait a moment before trying again." }, { status: 429 })
    } catch (redisErr) {
      console.warn("[payments/intent POST] Redis rate limit unavailable, allowing through:", redisErr)
    }

    const [caller] = await db
      .select({ role: users.role, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
    if (!caller) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (caller.role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const parsed = paymentIntentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // promoCodeDiscountCents is intentionally NOT destructured — the discount is recomputed
    // server-side (FIN-003); any client-supplied amount is ignored.
    const { providerId, serviceId, scheduledAt, carbonOffsetCents = 0, bidAmountCents, promoCodeId, addOnIds = [] } = parsed.data

    const [[provider], [service]] = await Promise.all([
      db
        .select({ id: providers.id, stripeAccountId: providers.stripeAccountId, stripeAccountStatus: providers.stripeAccountStatus, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
        .from(providers)
        .where(eq(providers.id, providerId)),
      db
        .select({ id: providerServices.id, basePrice: providerServices.basePrice })
        .from(providerServices)
        .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId), eq(providerServices.isActive, true))),
    ])

    if (!provider?.isApproved || provider.isSuspended) return NextResponse.json({ error: "Provider not available" }, { status: 422 })
    if (!provider.stripeAccountId) return NextResponse.json({ error: "Provider payment not set up" }, { status: 422 })
    // Don't route a destination charge to a Connect account that can't receive funds yet
    // (onboarding incomplete / charges disabled). account.updated keeps this in sync.
    if (provider.stripeAccountStatus && provider.stripeAccountStatus !== "active") {
      return NextResponse.json({ error: "Provider payment account not ready" }, { status: 422 })
    }
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

    // Bug 5: when booking from an accepted bid, validate the bid and use its amount as subtotal
    if (bidAmountCents !== undefined) {
      const [acceptedBid] = await db
        .select({ id: bids.id })
        .from(bids)
        .innerJoin(jobPosts, eq(bids.jobPostId, jobPosts.id))
        .where(and(
          eq(bids.providerId, providerId),
          eq(bids.amount, bidAmountCents),
          eq(bids.status, "accepted"),
          eq(jobPosts.customerId, userId),  // prevent using another customer's accepted bid
        ))
      if (!acceptedBid) return NextResponse.json({ error: "Accepted bid not found" }, { status: 422 })
    }

    // Sum the selected add-ons server-side, validated against this provider's active add-ons.
    let addOnsTotal = 0
    let validAddOnIds: string[] = []
    if (addOnIds.length > 0) {
      const rows = await db
        .select({ id: providerAddons.id, priceCents: providerAddons.priceCents })
        .from(providerAddons)
        .where(and(eq(providerAddons.providerId, providerId), eq(providerAddons.isActive, true), inArray(providerAddons.id, addOnIds)))
      addOnsTotal = rows.reduce((s, r) => s + r.priceCents, 0)
      validAddOnIds = rows.map((r) => r.id)
    }

    const subtotal = (bidAmountCents ?? service.basePrice) + addOnsTotal

    // Resolve promo discount: prefer the pre-computed promoCodeDiscountCents from the client,
    // but verify the promo code exists and is active when promoCodeId is supplied.
    let resolvedDiscountCents = 0
    if (promoCodeId) {
      const [promo] = await db
        .select({ discountType: promoCodes.discountType, discountValue: promoCodes.discountValue, maxDiscountCents: promoCodes.maxDiscountCents, isActive: promoCodes.isActive, expiresAt: promoCodes.expiresAt, minOrderCents: promoCodes.minOrderCents, maxUses: promoCodes.maxUses, usedCount: promoCodes.usedCount })
        .from(promoCodes)
        .where(eq(promoCodes.id, promoCodeId))
      if (!promo || !promo.isActive) return NextResponse.json({ error: "Promo code not valid" }, { status: 422 })
      if (promo.expiresAt && promo.expiresAt < new Date()) return NextResponse.json({ error: "Promo code expired" }, { status: 422 })
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return NextResponse.json({ error: "Promo code usage limit reached" }, { status: 422 })
      if (subtotal < promo.minOrderCents) return NextResponse.json({ error: "Order total too low for this promo code" }, { status: 422 })

      // SECURITY (FIN-003): never trust a client-supplied discount. Always recompute the
      // discount from the promo code's own definition; the request's promoCodeDiscountCents
      // is display-only and is deliberately ignored here.
      if (promo.discountType === "fixed") {
        resolvedDiscountCents = Math.min(promo.discountValue, subtotal)
      } else {
        // percentage
        const raw = Math.round(subtotal * promo.discountValue / 100)
        resolvedDiscountCents = promo.maxDiscountCents !== null ? Math.min(raw, promo.maxDiscountCents) : raw
      }
    }

    const subtotalAfterDiscount = Math.max(0, subtotal - resolvedDiscountCents)
    const commissionPct = await getCommissionPct()
    const amounts = calculateBookingAmounts(subtotalAfterDiscount, commissionPct)
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

    const metadata: Record<string, string> = {
      clerk_customer_id: userId,
      provider_id: providerId,
      service_id: serviceId,
      carbon_offset_cents: String(carbonOffsetCents),
      // FIN-010: pin the commission rate used for THIS PI so booking creation stores the
      // same split even if an admin changes the commission between PI creation and confirm.
      commission_pct: String(commissionPct),
    }
    if (bidAmountCents !== undefined) metadata.bid_amount_cents = String(bidAmountCents)
    if (promoCodeId) metadata.promo_code_id = promoCodeId
    if (resolvedDiscountCents > 0) metadata.promo_code_discount_cents = String(resolvedDiscountCents)
    if (addOnsTotal > 0) {
      metadata.addon_total_cents = String(addOnsTotal)
      // Stripe caps each metadata value at 500 chars — only store the ids when they fit.
      const idsStr = validAddOnIds.join(",")
      if (idsStr.length <= 480) metadata.addon_ids = idsStr
    }
    // Stable signature of the selected add-on set so swapping equal-priced add-ons on the
    // same slot creates a NEW PI instead of reusing the cached one (the total alone wouldn't differ).
    const addonSig = validAddOnIds.length
      ? createHash("sha1").update([...validAddOnIds].sort().join(",")).digest("hex").slice(0, 12)
      : "0"

    const intent = await stripe.paymentIntents.create(
      {
        amount: totalWithOffset,
        currency: "eur",
        capture_method: "manual",
        customer: stripeCustomerId,
        // Carbon offset stays with DORIXÉ (added to platform fee), not paid to provider
        application_fee_amount: amounts.platformFee + carbonOffsetCents,
        transfer_data: { destination: provider.stripeAccountId },
        metadata,
      },
      // Bug 1 + BUG-005: idempotency key includes scheduledAt AND the price-affecting inputs
      // (final total + promo code) so changing the promo or carbon offset on the same slot
      // creates a NEW PI with the correct amount, while pure network retries of the same
      // request still return the cached PI.
      { idempotencyKey: `pi-${userId}-${providerId}-${serviceId}-${scheduledAt}-${totalWithOffset}-${promoCodeId ?? "none"}-${addonSig}` },
    )

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amounts: { ...amounts, carbonOffsetCents, totalCharged: totalWithOffset, commissionPct },
    })
  } catch (err) {
    console.error("[payments/intent POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
