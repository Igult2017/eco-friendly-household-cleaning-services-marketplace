import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { storeProducts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"
import { updateStoreProductSchema } from "@/lib/validations/store"

const normalize = (v: string | null | undefined): string | null => (v ? v : null)

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid product id" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const parsed = updateStoreProductSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data

    try {
      await db
        .update(storeProducts)
        .set({
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.slug !== undefined ? { slug: data.slug } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: normalize(data.description) } : {}),
          ...(data.brand !== undefined ? { brand: normalize(data.brand) } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: normalize(data.imageUrl) } : {}),
          ...(data.affiliateUrl !== undefined ? { affiliateUrl: data.affiliateUrl } : {}),
          ...(data.priceCents !== undefined ? { priceCents: data.priceCents ?? null } : {}),
          ...(data.currency !== undefined ? { currency: normalize(data.currency) } : {}),
          ...(data.benefits !== undefined ? { benefits: data.benefits } : {}),
          ...(data.category !== undefined ? { category: normalize(data.category) } : {}),
          ...(data.tags !== undefined ? { tags: data.tags } : {}),
          ...(data.featured !== undefined ? { featured: data.featured } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(storeProducts.id, id))
    } catch (e) {
      // Editing the slug to one already in use violates the unique index — return a clear 409, not a 500.
      if ((e as { code?: string })?.code === "23505") {
        return NextResponse.json({ error: "A product with that slug already exists." }, { status: 409 })
      }
      throw e
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/store/[id] PATCH]", err)
    void logError({ message: "[admin/store/[id] PATCH]", error: err, route: "/api/admin/store/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid product id" }, { status: 400 })

    await db.delete(storeProducts).where(eq(storeProducts.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/store/[id] DELETE]", err)
    void logError({ message: "[admin/store/[id] DELETE]", error: err, route: "/api/admin/store/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
