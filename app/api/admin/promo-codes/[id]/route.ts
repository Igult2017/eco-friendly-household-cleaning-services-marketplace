import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { users, promoCodes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const patchSchema = z.object({
  isActive: z.boolean(),
})

async function requireAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return user?.role === "admin"
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params

    const parsed = patchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await db
      .update(promoCodes)
      .set({ isActive: parsed.data.isActive })
      .where(eq(promoCodes.id, id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/promo-codes/[id] PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
