import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { z } from "zod"
import { db } from "@/lib/db"
import { promoCodes } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"
import { ensureUserRow } from "@/lib/clerk/ensureUser"

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
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt))
    return NextResponse.json({ promoCodes: rows })
  } catch (err) {
    console.error("[admin/promo-codes GET]", err)
    void logError({ message: "[admin/promo-codes GET]", error: err, route: "/api/admin/promo-codes", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const userId = admin.adminId
    if (!(await ensureUserRow(userId))) return NextResponse.json({ error: "Could not link your admin account. Please reload and try again." }, { status: 500 })

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
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
    void logError({ message: "[admin/promo-codes POST]", error: err, route: "/api/admin/promo-codes", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
