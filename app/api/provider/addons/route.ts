import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerAddons } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const addonSchema = z.object({
  name: z.string().min(2).max(120),
  priceCents: z.number().int().min(50).max(100_000),
})

async function getProviderId(userId: string): Promise<string | null> {
  const [p] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  return p?.id ?? null
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const providerId = await getProviderId(userId)
    if (!providerId) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const addons = await db
      .select({ id: providerAddons.id, name: providerAddons.name, priceCents: providerAddons.priceCents, isActive: providerAddons.isActive })
      .from(providerAddons)
      .where(and(eq(providerAddons.providerId, providerId), eq(providerAddons.isActive, true)))

    return NextResponse.json({ addons })
  } catch (err) {
    console.error("[provider/addons GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const providerId = await getProviderId(userId)
    if (!providerId) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const parsed = addonSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [addon] = await db
      .insert(providerAddons)
      .values({ providerId, name: parsed.data.name, priceCents: parsed.data.priceCents })
      .returning({ id: providerAddons.id })

    return NextResponse.json({ id: addon.id }, { status: 201 })
  } catch (err) {
    console.error("[provider/addons POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const providerId = await getProviderId(userId)
    if (!providerId) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const { addonId } = await req.json().catch(() => ({} as { addonId?: string }))
    if (!addonId || !z.string().uuid().safeParse(addonId).success) {
      return NextResponse.json({ error: "Valid addonId required" }, { status: 400 })
    }

    // Ownership-scoped soft delete (keeps the WHERE bound to this provider).
    await db
      .update(providerAddons)
      .set({ isActive: false })
      .where(and(eq(providerAddons.id, addonId), eq(providerAddons.providerId, providerId)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[provider/addons DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
