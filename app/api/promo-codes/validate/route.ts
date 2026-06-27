import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { promoCodes, promoCodeUsages } from "@/lib/db/schema"
import { eq, and, ilike } from "drizzle-orm"
import { createRateLimiter, safeLimit } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

const bodySchema = z.object({
  code: z.string(),
  orderAmountCents: z.number().int().positive(),
})

// M5: rate-limit validation so promo codes can't be brute-force enumerated/harvested.
const promoValidateRatelimit = createRateLimiter({ tokens: 10, windowSeconds: 60, prefix: "ratelimit:promo-validate" })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success } = await safeLimit(promoValidateRatelimit, userId)
    if (!success) return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { code, orderAmountCents } = parsed.data

    const [promoCode] = await db
      .select()
      .from(promoCodes)
      .where(and(ilike(promoCodes.code, code), eq(promoCodes.isActive, true)))
      .limit(1)

    if (!promoCode) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 })
    }

    if (promoCode.expiresAt !== null && promoCode.expiresAt < new Date()) {
      return NextResponse.json({ error: "Promo code has expired" }, { status: 422 })
    }

    if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
      return NextResponse.json({ error: "Promo code has reached its usage limit" }, { status: 422 })
    }

    if (orderAmountCents < promoCode.minOrderCents) {
      return NextResponse.json({ error: "Order does not meet minimum amount" }, { status: 422 })
    }

    const [existingUsage] = await db
      .select({ id: promoCodeUsages.id })
      .from(promoCodeUsages)
      .where(and(eq(promoCodeUsages.promoCodeId, promoCode.id), eq(promoCodeUsages.userId, userId)))
      .limit(1)

    if (existingUsage) {
      return NextResponse.json({ error: "You have already used this code" }, { status: 422 })
    }

    let discountAmount: number
    if (promoCode.discountType === "fixed") {
      discountAmount = Math.min(promoCode.discountValue, orderAmountCents)
    } else {
      discountAmount = Math.round((orderAmountCents * promoCode.discountValue) / 100)
      if (promoCode.maxDiscountCents !== null) {
        discountAmount = Math.min(discountAmount, promoCode.maxDiscountCents)
      }
    }

    return NextResponse.json({
      valid: true,
      discountAmount,
      promoCodeId: promoCode.id,
      code: promoCode.code,
    })
  } catch (err) {
    console.error("[promo-codes/validate POST]", err)
    void logError({ message: "[promo-codes/validate POST]", error: err, route: "/api/promo-codes/validate", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
