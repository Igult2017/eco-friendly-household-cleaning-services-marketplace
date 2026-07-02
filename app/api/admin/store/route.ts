import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { storeProducts, type NewStoreProduct } from "@/lib/db/schema"
import { asc, desc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { logError } from "@/lib/utils/logError"
import { storeProductSchema } from "@/lib/validations/store"

/** Slugify: lowercase, trim, spaces→"-", strip chars not [a-z0-9-], collapse repeated "-". */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Guarantee slug uniqueness — append a short base36 suffix if the slug already exists. */
async function uniqueSlug(slug: string): Promise<string> {
  const [existing] = await db
    .select({ id: storeProducts.id })
    .from(storeProducts)
    .where(eq(storeProducts.slug, slug))
    .limit(1)
  if (!existing) return slug
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`
}

const normalize = (v: string | null | undefined): string | null => (v ? v : null)

export async function GET() {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const products = await db.query.storeProducts.findMany({
      orderBy: [asc(storeProducts.sortOrder), desc(storeProducts.createdAt)],
    })
    return NextResponse.json({ products })
  } catch (err) {
    console.error("[admin/store GET]", err)
    void logError({ message: "[admin/store GET]", error: err, route: "/api/admin/store", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const body = await req.json().catch(() => ({}))
    const parsed = storeProductSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data

    // Derive slug from title when omitted/blank, then guarantee uniqueness.
    const baseSlug = data.slug && data.slug.trim() ? data.slug : slugify(data.title)
    const slug = await uniqueSlug(baseSlug || slugify(data.title))

    const values: NewStoreProduct = {
      type: data.type,
      slug,
      title: data.title,
      description: normalize(data.description),
      brand: normalize(data.brand),
      imageUrl: normalize(data.imageUrl),
      affiliateUrl: data.affiliateUrl ?? "",
      priceCents: data.priceCents ?? null,
      currency: normalize(data.currency),
      benefits: data.benefits,
      category: normalize(data.category),
      packId: data.packId ?? null,
      tags: data.tags,
      featured: data.featured,
      status: data.status,
    }

    const [product] = await db
      .insert(storeProducts)
      .values(values)
      .returning({ id: storeProducts.id, slug: storeProducts.slug })

    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    console.error("[admin/store POST]", err)
    void logError({ message: "[admin/store POST]", error: err, route: "/api/admin/store", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
