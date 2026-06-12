import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { promoCodes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const patchSchema = z.object({
  isActive: z.boolean(),
})

function isAdmin(sessionClaims: unknown) {
  return (sessionClaims as { metadata?: { role?: string } } | undefined)?.metadata?.role === "admin"
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { sessionClaims } = await auth()
    if (!isAdmin(sessionClaims)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { sessionClaims } = await auth()
    if (!isAdmin(sessionClaims)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const [deleted] = await db
      .delete(promoCodes)
      .where(eq(promoCodes.id, id))
      .returning({ id: promoCodes.id })

    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/promo-codes/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
