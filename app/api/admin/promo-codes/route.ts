import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { promoCodes } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

const createSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive(),
  minOrderCents: z.number().int().min(0).default(0),
  maxDiscountCents: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
})

export async function GET() {
  try {
    const { sessionClaims } = await auth()
    if ((sessionClaims?.metadata as { role?: string } | undefined)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt))
    return NextResponse.json({ promoCodes: rows })
  } catch (err) {
    console.error("[admin/promo-codes GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if ((sessionClaims?.metadata as { role?: string } | undefined)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = createSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { code, discountType, discountValue, minOrderCents, maxDiscountCents, maxUses, expiresAt } =
      parsed.data

    try {
      const [result] = await db
        .insert(promoCodes)
        .values({
          code,
          discountType,
          discountValue: Math.round(discountValue),
          minOrderCents,
          maxDiscountCents: maxDiscountCents ?? null,
          maxUses: maxUses ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: userId,
        })
        .returning({ id: promoCodes.id })

      return NextResponse.json({ promoCodeId: result.id }, { status: 201 })
    } catch (dbErr: unknown) {
      const pg = dbErr as { code?: string }
      if (pg?.code === "23505") {
        return NextResponse.json(
          { error: { fieldErrors: { code: [`Code "${code}" already exists`] } } },
          { status: 409 },
        )
      }
      throw dbErr
    }
  } catch (err) {
    console.error("[admin/promo-codes POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
