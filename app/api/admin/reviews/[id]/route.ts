import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reviews } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const patchSchema = z.object({
  isPublic: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  adminNote: z.string().max(1000).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { sessionClaims } = await auth()
    if ((sessionClaims?.metadata as { role?: string } | undefined)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const updates: Partial<{ isPublic: boolean; isFlagged: boolean; adminNote: string }> = {}
    if (parsed.data.isPublic !== undefined) updates.isPublic = parsed.data.isPublic
    if (parsed.data.isFlagged !== undefined) updates.isFlagged = parsed.data.isFlagged
    if (parsed.data.adminNote !== undefined) updates.adminNote = parsed.data.adminNote

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const [updated] = await db
      .update(reviews)
      .set(updates)
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id })

    if (!updated) return NextResponse.json({ error: "Review not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/reviews/[id] PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
