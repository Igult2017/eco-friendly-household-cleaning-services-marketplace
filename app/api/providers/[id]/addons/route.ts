import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providerAddons } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

// Public: a provider's active add-ons, for the booking "extras" step.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const addons = await db
      .select({ id: providerAddons.id, name: providerAddons.name, priceCents: providerAddons.priceCents })
      .from(providerAddons)
      .where(and(eq(providerAddons.providerId, id), eq(providerAddons.isActive, true)))
    return NextResponse.json({ addons })
  } catch (err) {
    console.error("[providers/[id]/addons GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
