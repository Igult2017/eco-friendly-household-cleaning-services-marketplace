import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providerAddons, providers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

// Public: a provider's active add-ons, for the booking "extras" step.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const addons = await db
      .select({ id: providerAddons.id, name: providerAddons.name, priceCents: providerAddons.priceCents })
      .from(providerAddons)
      .innerJoin(providers, eq(providerAddons.providerId, providers.id))
      .where(and(
        eq(providerAddons.providerId, id),
        eq(providerAddons.isActive, true),
        eq(providers.isApproved, true), // L5: don't expose add-ons of unapproved/suspended providers
        eq(providers.isSuspended, false),
      ))
    return NextResponse.json({ addons })
  } catch (err) {
    console.error("[providers/[id]/addons GET]", err)
    void logError({ message: "[providers/[id]/addons GET]", error: err, route: "/api/providers/[id]/addons", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
