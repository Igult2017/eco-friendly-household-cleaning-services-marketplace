import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const updateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional(),
  marketingConsent: z.boolean().optional(),
})

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        marketingConsent: true,
      },
    })

    return NextResponse.json({ user: user ?? null })
  } catch (err) {
    console.error("[customers/profile GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const updateFields: Record<string, unknown> = { updatedAt: new Date() }

    if (data.firstName !== undefined) updateFields.firstName = data.firstName
    if (data.lastName !== undefined) updateFields.lastName = data.lastName
    if (data.phone !== undefined) updateFields.phone = data.phone
    if (data.marketingConsent !== undefined) updateFields.marketingConsent = data.marketingConsent

    await db.update(users).set(updateFields).where(eq(users.id, userId))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[customers/profile PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
