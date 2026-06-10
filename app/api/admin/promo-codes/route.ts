import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { users, promoCodes } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

const createSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().int().positive(),
  minOrderCents: z.number().int().min(0).default(0),
  maxDiscountCents: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
})

async function requireAdmin(userId: string) {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return user?.role === "admin"
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt))

    return NextResponse.json({ promoCodes: rows })
  } catch (err) {
    console.error("[admin/promo-codes GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = createSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { code, discountType, discountValue, minOrderCents, maxDiscountCents, maxUses, expiresAt } =
      parsed.data

    const [result] = await db
      .insert(promoCodes)
      .values({
        code,
        discountType,
        discountValue,
        minOrderCents,
        maxDiscountCents: maxDiscountCents ?? null,
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: userId,
      })
      .returning({ id: promoCodes.id })

    return NextResponse.json({ promoCodeId: result.id }, { status: 201 })
  } catch (err) {
    console.error("[admin/promo-codes POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
